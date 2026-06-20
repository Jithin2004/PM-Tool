import { supabase } from '../../lib/supabase';
import { LogicalStateCategory } from './statusResolver';

export const migrationHelper = {
  /**
   * Helper to map a legacy status string to a LogicalStateCategory
   */
  mapLegacyStatusToCategory(legacyStatus: string): LogicalStateCategory {
    switch (legacyStatus) {
      case 'todo':
      case 'backlog':
        return 'not_started';
      case 'in_progress':
        return 'active';
      case 'review':
        return 'review';
      case 'blocked':
        return 'blocked';
      case 'completed':
      case 'done':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'not_started';
    }
  },

  /**
   * Prepares a migration strategy for a given workspace and project.
   * Finds all tasks with legacy status and pairs them with the target workflow_state_id
   * based on category match with the chosen workflow.
   * 
   * @param projectId Project ID to migrate
   * @param targetWorkflowId The new workflow template ID to migrate tasks into
   * @returns Array of tasks with their proposed new workflow_state_id
   */
  async prepareTaskMigration(projectId: string, targetWorkflowId: string) {
    // 1. Fetch all states for the target workflow
    const { data: states, error: statesError } = await supabase
      .from('workflow_states')
      .select('*')
      .eq('workflow_template_id', targetWorkflowId);

    if (statesError || !states) {
      console.error('[migrationHelper] Failed to fetch states');
      return [];
    }

    // 2. Fetch all tasks for the project that still use legacy status
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, status, workflow_state_id')
      .eq('project_id', projectId)
      .is('workflow_state_id', null);

    if (tasksError || !tasks) {
      console.error('[migrationHelper] Failed to fetch tasks');
      return [];
    }

    // 3. Map tasks to the first available state matching their logical category
    const migrationPlan = tasks.map(task => {
      const targetCategory = this.mapLegacyStatusToCategory(task.status);
      const matchingState = states.find(s => s.state_category === targetCategory) || states[0];

      return {
        taskId: task.id,
        taskName: task.name,
        oldStatus: task.status,
        mappedCategory: targetCategory,
        newWorkflowStateId: matchingState?.id,
        newWorkflowStateName: matchingState?.name
      };
    });

    return migrationPlan;
  }
};
