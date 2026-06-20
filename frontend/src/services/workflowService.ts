import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';

export interface WorkflowTemplate {
  id: string;
  workspace_id?: string;
  name: string;
  function_type: string;
  template_type: string;
  configuration?: any;
  is_system_template: boolean;
  created_at: string;
}

export interface WorkflowState {
  id: string;
  workflow_template_id: string;
  name: string;
  order_index: number;
  state_category: string;
  metadata?: any;
}

export const workflowService = {
  async getAvailableWorkflows(workspaceId: string, functionType?: string): Promise<WorkflowTemplate[]> {
    let query = supabase
      .from('workflow_templates')
      .select('*')
      .or(`is_system_template.eq.true,workspace_id.eq.${workspaceId}`);

    if (functionType) {
      query = query.eq('function_type', functionType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[workflowService.getAvailableWorkflows] Error:', error);
      return [];
    }
    return data || [];
  },

  async getWorkflowStates(workflowId: string): Promise<WorkflowState[]> {
    const { data, error } = await supabase
      .from('workflow_states')
      .select('*')
      .eq('workflow_template_id', workflowId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[workflowService.getWorkflowStates] Error:', error);
      return [];
    }
    return data || [];
  },

  async assignWorkflowToProject(projectId: string, workflowId: string): Promise<boolean> {
    // Note: To fully assign a workflow to a project, there needs to be a link.
    // Assuming for now it modifies project metadata or default states.
    // Or just a placeholder as requested.
    const { error } = await supabase
      .from('projects')
      .update({ execution_mode: 'CUSTOM', metadata: { default_workflow_id: workflowId } })
      .eq('id', projectId);

    if (error) {
      console.error('[workflowService.assignWorkflowToProject] Error:', error);
      return false;
    }
    return true;
  },

  async moveEntityState(
    workspaceId: string,
    entityType: string,
    entityId: string,
    newStateId: string,
    oldStateId?: string,
    actorId?: string
  ): Promise<boolean> {
    // 1. Update workflow_state_id (assuming entity is task for now, as tasks altered)
    let table = '';
    if (entityType === 'task') table = 'tasks';
    
    if (!table) return false;

    const { error: updateError } = await supabase
      .from(table)
      .update({ workflow_state_id: newStateId })
      .eq('id', entityId);

    if (updateError) {
      console.error('[workflowService.moveEntityState] Update error:', updateError);
      return false;
    }

    // 2. Write activity_events entry
    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId,
      action_type: 'state_changed',
      before_value: { workflow_state_id: oldStateId },
      after_value: { workflow_state_id: newStateId }
    });

    return true;
  }
};
