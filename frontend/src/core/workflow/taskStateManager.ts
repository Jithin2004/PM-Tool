import { supabase } from '../../lib/supabase';
import { activityEventService } from '../../services/activityEventService';
import { LogicalStateCategory, statusResolver } from './statusResolver';
import { ExecutionState } from '../types/execution';

export const taskStateManager = {
  /**
   * Safe mapping from a logical category to a legacy execution state (status)
   */
  mapCategoryToLegacyStatus(category: LogicalStateCategory): ExecutionState {
    switch (category) {
      case 'backlog': return 'backlog';
      case 'not_started': return 'ready';
      case 'active': return 'in_progress';
      case 'review': return 'review';
      case 'blocked': return 'blocked';
      case 'completed': return 'done';
      case 'cancelled': return 'cancelled';
      default: return 'ready';
    }
  },

  /**
   * The primary future method to move task states.
   * Updates BOTH workflow_state_id and legacy status, creating an activity event.
   */
  async moveTaskState(
    workspaceId: string,
    taskId: string,
    targetStateId: string,
    actorId?: string
  ): Promise<boolean> {
    try {
      // 1. Fetch current task state and the target state details
      const [{ data: task }, { data: targetState }] = await Promise.all([
        supabase.from('tasks').select('id, status, workflow_state_id, workflow_state:workflow_state_id(name)').eq('id', taskId).single(),
        supabase.from('workflow_states').select('id, name, state_category').eq('id', targetStateId).single()
      ]);

      if (!task || !targetState) return false;

      // 2. Map logical category back to legacy status for safety
      const newLegacyStatus = this.mapCategoryToLegacyStatus(targetState.state_category as LogicalStateCategory);

      // 3. Update task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          workflow_state_id: targetState.id,
          status: newLegacyStatus
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // 4. Create Activity Event
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: actorId,
        entity_type: 'task',
        entity_id: taskId,
        action_type: 'state_changed',
        before_value: {
          workflow_state_id: task.workflow_state_id,
          state_name: (task.workflow_state as any)?.name || task.status,
          legacy_status: task.status
        },
        after_value: {
          workflow_state_id: targetState.id,
          state_name: targetState.name,
          legacy_status: newLegacyStatus
        }
      });

      return true;
    } catch (err) {
      console.error('[taskStateManager.moveTaskState] Failed', err);
      return false;
    }
  },

  /**
   * Temporary compatibility layer for reverse sync.
   * If a legacy component updates task.status (e.g. to 'completed'), 
   * this finds a matching workflow_state and syncs workflow_state_id.
   */
  async syncLegacyStatus(taskId: string, newLegacyStatus: ExecutionState): Promise<boolean> {
    try {
      // Find the task and its project's workflow template
      const { data: task } = await supabase
        .from('tasks')
        .select('id, project_id, project:project_id(workflow_template_id)')
        .eq('id', taskId)
        .single();

      if (!task || !(task.project as any)?.workflow_template_id) return false;

      // Find logical category for the legacy status
      const targetCategory = statusResolver.getLogicalStatus({ status: newLegacyStatus }).category;

      // Find the matching workflow state in the project's workflow template
      const { data: states } = await supabase
        .from('workflow_states')
        .select('id, state_category')
        .eq('workflow_template_id', (task.project as any)?.workflow_template_id);

      if (!states || states.length === 0) return false;

      // Match state by category, or just default to the first state if no match
      const matchingState = states.find(s => s.state_category === targetCategory) || states[0];

      // Sync the workflow state
      const { error } = await supabase
        .from('tasks')
        .update({ workflow_state_id: matchingState.id })
        .eq('id', taskId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[taskStateManager.syncLegacyStatus] Failed', err);
      return false;
    }
  }
};
