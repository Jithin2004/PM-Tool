import { supabase } from '../../lib/supabase';
import { WorkflowTemplate, WorkflowState, workflowService } from '../../services/workflowService';

export interface ResolvedWorkflow {
  template: WorkflowTemplate;
  states: WorkflowState[];
  isFallback: boolean;
}

export const workflowResolver = {
  /**
   * Resolves the workflow for a given project.
   * If the project has a template assigned, it loads it.
   * If not, it falls back to the system default 'Engineering Kanban'.
   */
  async resolveProjectWorkflow(projectId: string): Promise<ResolvedWorkflow | null> {
    try {
      // 1. Get project workflow
      const { data: project } = await supabase
        .from('projects')
        .select('workflow_template_id')
        .eq('id', projectId)
        .single();

      let templateId = project?.workflow_template_id;
      let isFallback = false;

      // 2. If no template assigned, load fallback
      if (!templateId) {
        const { data: fallbackTemplate } = await supabase
          .from('workflow_templates')
          .select('id')
          .eq('name', 'Engineering Kanban')
          .eq('is_system_template', true)
          .single();

        if (fallbackTemplate) {
          templateId = fallbackTemplate.id;
          isFallback = true;
        } else {
          // If the system template doesn't exist for some reason, grab any system template
          const { data: anyTemplate } = await supabase
            .from('workflow_templates')
            .select('id')
            .eq('is_system_template', true)
            .limit(1)
            .single();
          
          if (anyTemplate) {
            templateId = anyTemplate.id;
            isFallback = true;
          } else {
             return null;
          }
        }
      }

      // 3. Load full template and states
      const [{ data: template }, states] = await Promise.all([
        supabase.from('workflow_templates').select('*').eq('id', templateId).single(),
        workflowService.getWorkflowStates(templateId)
      ]);

      if (!template) return null;

      return {
        template,
        states,
        isFallback
      };
    } catch (err) {
      console.error('[workflowResolver.resolveProjectWorkflow] Failed', err);
      return null;
    }
  }
};
