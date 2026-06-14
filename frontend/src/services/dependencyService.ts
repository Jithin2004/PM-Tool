import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CrossProjectDependency {
  id: string;
  workspace_id: string;
  blocked_task_id: string;
  blocked_task_title: string;
  blocked_task_status: string;
  blocked_project_name: string;
  blocking_task_id: string;
  blocking_task_title: string;
  blocking_task_status: string;
  blocking_project_name: string;
}

export const dependencyService = {
  /**
   * Fetches cross-project dependencies where a task in one project is blocked by a task in another project.
   */
  async getCrossProjectDependencies(workspaceId: string): Promise<{ data: CrossProjectDependency[], error: any }> {
    if (!isSupabaseConfigured) return { data: [], error: new Error('Supabase not configured') };
    
    try {
      const { data, error } = await supabase
        .from('cross_project_dependencies')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      return { data: (data || []) as CrossProjectDependency[], error: null };
    } catch (e) {
      console.error('Failed to fetch cross-project dependencies:', e);
      return { data: [], error: e };
    }
  }
};
