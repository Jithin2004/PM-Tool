import { hasCapability } from '../auth/permissions';
import { supabase } from '../../lib/supabase';
import { searchIndexService } from '../../services/searchIndexService';

export const commandEngine = {
  async executeCommand(
    workspaceId: string, 
    userId: string, 
    role: string, 
    action: string, 
    entityType: string, 
    entityId: string, 
    payload?: any
  ): Promise<{ success: boolean; message: string }> {
    
    // First, track that this entity was accessed
    await searchIndexService.trackRecentEntity(workspaceId, userId, entityType, entityId);

    if (action === 'open') {
      // Navigation is handled by the UI router, but tracking is done above.
      return { success: true, message: 'Opened' };
    }

    if (action === 'assign_task' && entityType === 'task') {
      if (!payload?.assigneeId) return { success: false, message: 'No assignee provided' };
      // Developer can assign tasks if it's their task or if they are just taking it, but generally anyone can assign if it's unassigned.
      const { error } = await supabase.from('tasks').update({ assignee_id: payload.assigneeId }).eq('id', entityId);
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Task assigned' };
    }

    if (action === 'move_state' && entityType === 'task') {
      if (!payload?.status) return { success: false, message: 'No status provided' };
      const { error } = await supabase.from('tasks').update({ status: payload.status }).eq('id', entityId);
      if (error) return { success: false, message: error.message };
      return { success: true, message: `Moved to ${payload.status}` };
    }

    if (action === 'add_comment') {
      if (!payload?.content) return { success: false, message: 'No comment content' };
      const { error } = await supabase.from('entity_comments').insert({
        workspace_id: workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        author_id: userId,
        content: payload.content
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Comment added' };
    }

    if (action === 'start_timer' && entityType === 'task') {
      // Check if user has active session
      const { data: activeSessions } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('end_time', null);

      if (activeSessions && activeSessions.length > 0) {
        return { success: false, message: 'You already have an active timer' };
      }

      const { error } = await supabase.from('work_sessions').insert({
        workspace_id: workspaceId,
        user_id: userId,
        task_id: entityId,
        start_time: new Date().toISOString()
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Timer started' };
    }

    // Role-restricted commands
    if (action === 'delete') {
      if (!hasCapability(role, 'project.update') && role !== 'admin' && role !== 'owner') {
        return { success: false, message: 'Permission denied: Cannot delete entity' };
      }
      // Implement soft delete or actual delete
      return { success: false, message: 'Delete not implemented via command palette yet' };
    }

    return { success: false, message: 'Unknown command' };
  }
};

