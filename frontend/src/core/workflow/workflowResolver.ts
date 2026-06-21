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
      const { data: projectData } = await supabase
        .from('projects')
        .select('workflow_template_id')
        .eq('id', projectId)
        .limit(1);

      const project = projectData?.[0];
      let templateId = project?.workflow_template_id;
      let isFallback = false;

      // 2. If no template assigned, load fallback
      if (!templateId) {
        const { data: fallbackTemplateData } = await supabase
          .from('workflow_templates')
          .select('id')
          .eq('name', 'Engineering Kanban')
          .eq('is_system_template', true)
          .limit(1);

        const fallbackTemplate = fallbackTemplateData?.[0];

        if (fallbackTemplate) {
          templateId = fallbackTemplate.id;
          isFallback = true;
        } else {
          // If the system template doesn't exist for some reason, grab any system template
          const { data: anyTemplateData } = await supabase
            .from('workflow_templates')
            .select('id')
            .eq('is_system_template', true)
            .limit(1);
            
          const anyTemplate = anyTemplateData?.[0];
          
          if (anyTemplate) {
            templateId = anyTemplate.id;
            isFallback = true;
          } else {
             return null;
          }
        }
      }

      // 3. Load full template and states
      const templatePromise = supabase.from('workflow_templates').select('*').eq('id', templateId).limit(1).then(res => ({ data: res.data?.[0], error: res.error }));
      const [templateRes, states] = await Promise.all([
        templatePromise,
        workflowService.getWorkflowStates(templateId)
      ]);
      const template = templateRes.data;

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
