import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { logServiceFailure } from '../utils/supabaseError';
import type { WorkSession, WorkSessionPause, WorkSessionType } from '../core/types/execution';
import type { Workspace } from '../core/types';

export const workSessionService = {
  async getActiveSession(userId: string): Promise<WorkSession | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'paused'])
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        logServiceFailure('getActiveSession', { userId }, error);
        return null;
      }
      return data as WorkSession | null;
    } catch (e) {
      return null;
    }
  },

  async getSessionPauses(sessionId: string): Promise<WorkSessionPause[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('work_session_pauses')
        .select('*')
        .eq('session_id', sessionId)
        .order('pause_start', { ascending: true });
      if (error) { logServiceFailure('getSessionPauses', { sessionId }, error); return []; }
      return data as WorkSessionPause[] || [];
    } catch (e) {
      return [];
    }
  },

  calculateSessionType(workspace: Workspace): WorkSessionType {
    const now = new Date();
    const day = now.getDay();
    // workdays array typically [1, 2, 3, 4, 5] for Mon-Fri
    if (!workspace.workdays.includes(day)) {
      return 'weekend';
    }

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMins = currentHour * 60 + currentMin;

    const [startH, startM] = workspace.work_start.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const [endH, endM] = workspace.work_end.split(':').map(Number);
    const endMins = endH * 60 + endM;

    if (currentMins < startMins || currentMins > endMins) {
      return 'overtime';
    }

    return 'normal';
  },

  async startSession(workspace: Workspace, taskId: string, userId: string): Promise<WorkSession | null> {
    if (!isSupabaseConfigured) return null;
    try {
      // End any existing session
      const existing = await this.getActiveSession(userId);
      if (existing) {
        await this.stopSession(existing.id, workspace.id, userId);
      }

      const sessionType = this.calculateSessionType(workspace);

      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          workspace_id: workspace.id,
          task_id: taskId,
          user_id: userId,
          session_type: sessionType,
          status: 'active'
        })
        .select('*')
        .single();
        
      if (error) { logServiceFailure('startSession', { taskId, userId }, error); return null; }
      
      await activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: userId,
        action: 'work_session_started',
        project_id: null,
        metadata: { task_id: taskId, session_type: sessionType }
      });
      
      return data as WorkSession;
    } catch (e) {
      return null;
    }
  },

  async pauseSession(sessionId: string, reason: string, workspaceId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      await supabase.from('work_sessions').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', sessionId);
      await supabase.from('work_session_pauses').insert({
        session_id: sessionId,
        reason
      });
      
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'work_session_paused',
        project_id: null,
        metadata: { session_id: sessionId, reason }
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  async resumeSession(sessionId: string, workspaceId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      // Find open pause
      const { data: pauses } = await supabase
        .from('work_session_pauses')
        .select('*')
        .eq('session_id', sessionId)
        .is('pause_end', null)
        .order('pause_start', { ascending: false })
        .limit(1);

      if (pauses && pauses.length > 0) {
        await supabase
          .from('work_session_pauses')
          .update({ pause_end: new Date().toISOString() })
          .eq('id', pauses[0].id);
      }

      await supabase.from('work_sessions').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', sessionId);
      return true;
    } catch (e) {
      return false;
    }
  },

  async stopSession(sessionId: string, workspaceId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      // Sprint 9 Security: Duration is now computed SERVER-SIDE via PostgreSQL RPC.
      // This prevents client-side manipulation of hours, started_at, or duration_minutes.
      const { data, error } = await supabase.rpc('complete_work_session', {
        p_session_id: sessionId
      });

      if (error) { logServiceFailure('stopSession', { sessionId }, error); return false; }

      const result = data as { success: boolean; duration_minutes?: number; requires_review?: boolean; error?: string };

      if (!result?.success) {
        logServiceFailure('stopSession', { sessionId }, new Error(result?.error || 'Server rejected session completion'));
        return false;
      }

      // Activity log is now written server-side by the RPC function.
      // No need for a separate client-side log entry.

      return true;
    } catch (e) {
      return false;
    }
  },

  async editSession(sessionId: string, workspaceId: string, userId: string, updates: Partial<WorkSession>, reason: string): Promise<{ success: boolean; requiresApproval: boolean }> {
    if (!isSupabaseConfigured) return { success: false, requiresApproval: false };
    try {
      const { data: oldSession } = await supabase.from('work_sessions').select('*').eq('id', sessionId).single();
      if (!oldSession) return { success: false, requiresApproval: false };

      if (oldSession.locked_at) {
        throw new Error('Cannot edit a locked session. Create an adjustment instead.');
      }
      
      const now = new Date();
      const sessionDate = new Date(oldSession.started_at);
      const isSameDay = now.getFullYear() === sessionDate.getFullYear() &&
                        now.getMonth() === sessionDate.getMonth() &&
                        now.getDate() === sessionDate.getDate();

      if (!isSameDay) {
        // Create an approval request instead of editing directly
        const { error } = await supabase.from('universal_approvals').insert({
          workspace_id: workspaceId,
          entity_type: 'time_entry_edit',
          entity_id: sessionId,
          requested_by: userId,
          decision: 'Pending',
          note: JSON.stringify({
            updates,
            reason
          })
        });
        if (error) throw error;
        
        await activityLogService.appendLog({
          workspace_id: workspaceId,
          actor_id: userId,
          action: 'work_session_edit_approval_requested',
          metadata: { session_id: sessionId, updates, reason }
        });
        
        return { success: true, requiresApproval: true };
      }
      
      const { error } = await supabase
        .from('work_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) { logServiceFailure('editSession', { sessionId }, error); return { success: false, requiresApproval: false }; }

      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'work_session_edited',
        project_id: null,
        metadata: { 
          session_id: sessionId, 
          reason,
          before: oldSession,
          after: updates
        }
      });
      return { success: true, requiresApproval: false };
    } catch (e) {
      return { success: false, requiresApproval: false };
    }
  },

  async addManualSession(workspaceId: string, taskId: string, userId: string, start: Date, end: Date, reason: string): Promise<{ success: boolean; requiresApproval: boolean }> {
    if (!isSupabaseConfigured) return { success: false, requiresApproval: false };
    try {
      if (end.getTime() <= start.getTime()) {
        return { success: false, requiresApproval: false };
      }
      const durationMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
      
      // If > 2 hours, requires PM approval
      if (durationMins > 120) {
        const { error } = await supabase.from('universal_approvals').insert({
          workspace_id: workspaceId,
          entity_type: 'time_entry',
          entity_id: taskId,
          requested_by: userId,
          decision: 'Pending',
          note: JSON.stringify({
            started_at: start.toISOString(),
            ended_at: end.toISOString(),
            duration_minutes: durationMins,
            reason
          })
        });
        if (error) throw error;
        
        await activityLogService.appendLog({
          workspace_id: workspaceId,
          actor_id: userId,
          action: 'work_session_manual_approval_requested',
          metadata: { task_id: taskId, duration_minutes: durationMins, reason }
        });
        
        return { success: true, requiresApproval: true };
      }

      // Small correction <= 2 hours auto-approved
      const { error } = await supabase.from('work_sessions').insert({
        workspace_id: workspaceId,
        task_id: taskId,
        user_id: userId,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_minutes: durationMins,
        session_type: 'normal',
        entry_type: 'manual',
        status: 'completed'
      });
      
      if (error) throw error;

      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'work_session_manual_added',
        metadata: { task_id: taskId, duration_minutes: durationMins, reason }
      });
      
      return { success: true, requiresApproval: false };
    } catch (e) {
      return { success: false, requiresApproval: false };
    }
  },

  async lockSession(sessionId: string, workspaceId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('work_sessions').update({
        locked_at: new Date().toISOString(),
        locked_by: userId
      }).eq('id', sessionId);
      
      if (error) throw error;
      
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'work_session_locked',
        metadata: { session_id: sessionId }
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  async adjustSession(sessionId: string, workspaceId: string, userId: string, newValueMins: number, reason: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { data: session } = await supabase.from('work_sessions').select('*').eq('id', sessionId).single();
      if (!session) return false;

      const oldValueMins = session.duration_minutes || 0;

      const { error: adjError } = await supabase.from('work_session_adjustments').insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        old_value_mins: oldValueMins,
        new_value_mins: newValueMins,
        reason,
        created_by: userId
      });

      if (adjError) throw adjError;

      // Even if locked, we allow an adjustment to update the duration since it's an audited correction
      const { error: updError } = await supabase.from('work_sessions').update({
        duration_minutes: newValueMins,
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);

      if (updError) throw updError;

      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'work_session_adjusted',
        metadata: { session_id: sessionId, old_value_mins: oldValueMins, new_value_mins: newValueMins, reason }
      });

      return true;
    } catch (e) {
      return false;
    }
  }
};
