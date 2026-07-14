import { supabase } from '../../lib/supabase';
import { workSessionEngine } from './workSessionEngine';
import { enterpriseEventPublisher } from '../../services/enterpriseEventPublisher';

export const attendanceEngine = {
  async clockIn(workspaceId: string, userId: string) {
    const now = new Date();
    
    // Check if late based on policy
    const isLate = await this.calculateLateArrival(workspaceId, now);

    const { data, error } = await supabase
      .from('clock_events')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        event_type: 'CLOCK_IN',
        timestamp: now.toISOString(),
        metadata: { payroll_eligible: true, is_late: isLate }
      })
      .select()
      .single();

    if (error) throw error;

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: 'attendance',
      entity_id: data.id,
      verb: 'clock_in',
      title: 'Clocked In',
      description: `User clocked in${isLate ? ' (Late arrival)' : ''}.`,
      severity: isLate ? 'medium' : 'low',
      importance: 'info',
      icon_key: 'clock',
      visibility: 'public',
      module: 'attendance',
      metadata: { is_late: isLate }
    });

    if (isLate) {
      await this._routeLateApproval(workspaceId, userId, data.id, now);
    }

    return data;
  },

  async clockOut(workspaceId: string, userId: string) {
    const now = new Date();
    const { data, error } = await supabase
      .from('clock_events')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        event_type: 'CLOCK_OUT',
        timestamp: now.toISOString(),
        metadata: { payroll_eligible: true }
      })
      .select()
      .single();

    if (error) throw error;

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: 'attendance',
      entity_id: data.id,
      verb: 'clock_out',
      title: 'Clocked Out',
      description: 'User clocked out.',
      severity: 'low',
      importance: 'info',
      icon_key: 'clock',
      visibility: 'public',
      module: 'attendance'
    });
    
    // Also end any active work session
    await workSessionEngine.endActiveSession(workspaceId, userId, 'Clocked Out');
    
    return data;
  },

  async pauseSession(workspaceId: string, userId: string, reason?: string) {
    const now = new Date();
    const { data, error } = await supabase
      .from('clock_events')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        event_type: 'PAUSE',
        timestamp: now.toISOString(),
        metadata: { reason }
      })
      .select()
      .single();

    if (error) throw error;

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: 'attendance',
      entity_id: data.id,
      verb: 'break_start',
      title: 'Break Started',
      description: `User started break${reason ? `: ${reason}` : ''}.`,
      severity: 'low',
      importance: 'info',
      icon_key: 'pause',
      visibility: 'public',
      module: 'attendance',
      metadata: { reason }
    });
    
    // Also end any active work session on pause
    await workSessionEngine.endActiveSession(workspaceId, userId, 'Attendance Paused');
    
    return data;
  },

  async resumeSession(workspaceId: string, userId: string) {
    const now = new Date();
    const { data, error } = await supabase
      .from('clock_events')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        event_type: 'RESUME',
        timestamp: now.toISOString(),
        metadata: {}
      })
      .select()
      .single();

    if (error) throw error;

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: 'attendance',
      entity_id: data.id,
      verb: 'break_end',
      title: 'Break Ended',
      description: 'User resumed work.',
      severity: 'low',
      importance: 'info',
      icon_key: 'clock',
      visibility: 'public',
      module: 'attendance'
    });

    return data;
  },

  async getCurrentSession(workspaceId: string, userId: string) {
    // Get the most recent event for today
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('clock_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('timestamp', start.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current session:', error);
      return null;
    }
    
    return data || null;
  },

  async getDailyStatus(workspaceId: string, userId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('clock_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: true });

    return data || [];
  },

  async calculateLateArrival(workspaceId: string, timestamp: Date) {
    const { data: policy } = await supabase
      .from('attendance_policies')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!policy?.settings?.shifts) return false;
    
    const shift = policy.settings.shifts[0]; // Simplified to general shift for now
    if (!shift) return false;

    const [hours, minutes] = shift.start.split(':').map(Number);
    const expectedTime = new Date(timestamp);
    expectedTime.setHours(hours, minutes + (shift.grace_minutes || 0), 0, 0);

    return timestamp.getTime() > expectedTime.getTime();
  },

  async requestCorrection(workspaceId: string, userId: string, requestedTime: Date, eventType: string, reason: string) {
    // Generates a Universal Approval request instead of mutating DB
    await supabase.from('universal_approvals').insert({
      workspace_id: workspaceId,
      entity_type: 'attendance_adjustment',
      entity_id: userId,
      type: 'attendance_correction',
      status: 'pending',
      requested_by: userId,
      metadata: { requestedTime: requestedTime.toISOString(), eventType, reason }
    });

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: 'attendance',
      verb: 'manual_adjustment',
      title: 'Manual Adjustment Requested',
      description: `Manual adjustment requested for ${eventType}: ${reason}`,
      severity: 'medium',
      importance: 'normal',
      icon_key: 'warning',
      visibility: 'admin',
      module: 'attendance',
      metadata: { requestedTime: requestedTime.toISOString(), eventType, reason }
    });
  },

  async _routeLateApproval(workspaceId: string, userId: string, eventId: string, timestamp: Date) {
    await supabase.from('universal_approvals').insert({
      workspace_id: workspaceId,
      entity_type: 'clock_events',
      entity_id: eventId,
      type: 'late_arrival',
      status: 'pending',
      requested_by: userId,
      metadata: { timestamp: timestamp.toISOString() }
    });
  }
};
