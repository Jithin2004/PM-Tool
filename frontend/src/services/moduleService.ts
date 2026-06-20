import { supabase, isSupabaseConfigured } from '../lib/supabase';
export interface ProjectModule { id: string; workspace_id: string; project_id: string; name: string; code: string; created_at: string; }
import { activityEventService } from './activityEventService';

export const moduleService = {
  async getProjectModules(projectId: string): Promise<ProjectModule[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('project_modules')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[moduleService.getProjectModules] Error:', error);
      return [];
    }
    return data || [];
  },

  async createModule(
    workspaceId: string,
    projectId: string,
    name: string,
    code: string,
    description?: string,
    actorId?: string
  ): Promise<ProjectModule | null> {
    if (!isSupabaseConfigured) return null;
    
    try {
      const { data, error } = await supabase
        .from('project_modules')
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          name,
          code,
          description
        })
        .select()
        .single();

      if (error || !data) throw error;

      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: actorId,
        entity_type: 'project',
        entity_id: projectId,
        action_type: 'module_changed',
        after_value: { module_id: data.id, name, code }
      });

      return data;
    } catch (err) {
      console.error('[moduleService.createModule] Error:', err);
      return null;
    }
  }
};
