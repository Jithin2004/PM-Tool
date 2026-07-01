import { supabase } from '../../lib/supabase';
import { activityEventService } from '../../services/activityEventService';

export interface WorkSessionContext {
  projectId?: string;
  milestoneId?: string;
  epicId?: string;
  storyId?: string;
  taskId?: string;
  quickWorkItemId?: string;
  sessionType: string;
  title?: string;
  description?: string;
}

export const workSessionEngine = {
  /**
   * Closes the active work session and creates a new one with the given context.
   * If there is no active work session, it simply creates a new one.
   */
  async switchWorkContext(workspaceId: string, userId: string, context: WorkSessionContext, reason?: string) {
    const now = new Date();

    // 1. End any currently active work session
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('id, started_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (activeSession) {
      const startedAt = new Date(activeSession.started_at);
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      
      await supabase
        .from('work_sessions')
        .update({
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          switch_reason: reason
        })
        .eq('id', activeSession.id);
    }

    // 2. Fetch the active attendance session ID if clocked in (Optional, but good for tracking)
    // We assume getActiveAttendanceSession returns the row ID of the current CLOCK_IN event, if any.
    let attendanceSessionId = null;
    const { data: attendance } = await supabase
      .from('clock_events')
      .select('id, event_type')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('timestamp', new Date(now.setHours(0,0,0,0)).toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
      
    if (attendance && (attendance.event_type === 'CLOCK_IN' || attendance.event_type === 'RESUME')) {
      attendanceSessionId = attendance.id;
    }

    // 3. Create the new work session
    const { data: newSession, error: createError } = await supabase
      .from('work_sessions')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        attendance_session_id: attendanceSessionId,
        project_id: context.projectId || null,
        milestone_id: context.milestoneId || null,
        epic_id: context.epicId || null,
        story_id: context.storyId || null,
        task_id: context.taskId || null,
        quick_work_item_id: context.quickWorkItemId || null,
        session_type: context.sessionType || 'general',
        title: context.title || 'General Work',
        description: context.description || null,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating work session:', createError);
      throw createError;
    }

    // 4. Generate audit event
    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: userId,
      entity_type: 'work_session',
      entity_id: newSession.id,
      action_type: 'work_context_switched',
      metadata: { 
        session_type: context.sessionType,
        title: context.title,
        reason: reason
      }
    });

    return newSession;
  },

  /**
   * Retrieves the current active work session for a user.
   */
  async getActiveSession(workspaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('work_sessions')
      .select(`
        *,
        project:projects(id, name),
        task:tasks(id, name, task_number)
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching active work session:', error);
      return null;
    }

    return data || null;
  },
  
  /**
   * Get all work sessions for today for the timeline
   */
  async getTodaySessions(workspaceId: string, userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('work_sessions')
      .select(`
        *,
        project:projects(id, name),
        task:tasks(id, name, task_number)
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('started_at', start.toISOString())
      .order('started_at', { ascending: true });

    return data || [];
  },

  /**
   * Close the active work session (called when Clocking Out or Pausing)
   */
  async endActiveSession(workspaceId: string, userId: string, reason: string = 'Ended') {
    const now = new Date();
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('id, started_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (activeSession) {
      const startedAt = new Date(activeSession.started_at);
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      
      await supabase
        .from('work_sessions')
        .update({
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          switch_reason: reason
        })
        .eq('id', activeSession.id);
    }
  },

  /**
   * Retrieves the most recently completed work session for a user (used for Resume prompts).
   */
  async getLastWorkSession(workspaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('work_sessions')
      .select(`
        *,
        project:projects(id, name),
        task:tasks(id, name, task_number)
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching last work session:', error);
      return null;
    }

    return data || null;
  }
};
