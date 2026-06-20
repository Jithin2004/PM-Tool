import { supabase } from '../lib/supabase';
import { migrationHelper } from '../core/workflow/migrationHelper';

export interface MigrationPreviewResult {
  totalTasks: number;
  mapping: Record<string, { newWorkflowStateName: string; count: number }>;
}

export interface ManualMappingOption {
  oldStatus: string;
  newWorkflowStateId: string;
}

export const workflowMigrationService = {
  /**
   * Previews how tasks would be mapped without altering the DB.
   */
  async previewMigration(projectId: string, targetWorkflowId: string): Promise<MigrationPreviewResult | null> {
    try {
      const plan = await migrationHelper.prepareTaskMigration(projectId, targetWorkflowId);
      
      if (!plan || plan.length === 0) {
        return { totalTasks: 0, mapping: {} };
      }

      const mapping: Record<string, { newWorkflowStateName: string; count: number }> = {};
      
      plan.forEach(task => {
        const key = task.oldStatus;
        if (!mapping[key]) {
          mapping[key] = {
            newWorkflowStateName: task.newWorkflowStateName || 'Unknown',
            count: 0
          };
        }
        mapping[key].count += 1;
      });

      return {
        totalTasks: plan.length,
        mapping
      };
    } catch (err) {
      console.error('[workflowMigrationService.previewMigration] Failed', err);
      return null;
    }
  },

  /**
   * Applies the migration using a manual mapping configuration array.
   */
  async applyManualMigration(projectId: string, manualMappings: ManualMappingOption[]): Promise<boolean> {
    try {
      // Fetch all tasks without workflow_state_id
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId)
        .is('workflow_state_id', null);

      if (!tasks || tasks.length === 0) return true; // Nothing to do

      // Batch update logic would ideally run on the backend via RPC.
      // For this client-side mockup, we do simple iteration.
      for (const task of tasks) {
        const mapping = manualMappings.find(m => m.oldStatus === task.status);
        if (mapping && mapping.newWorkflowStateId) {
          await supabase
            .from('tasks')
            .update({ workflow_state_id: mapping.newWorkflowStateId })
            .eq('id', task.id);
        }
      }

      return true;
    } catch (err) {
      console.error('[workflowMigrationService.applyManualMigration] Failed', err);
      return false;
    }
  }
};
