import { supabase } from '../lib/supabase';

export interface SearchHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  missing_count: number;
  orphan_count: number;
  stale_count: number;
  recommendations: string[];
}

export const searchHealthService = {
  async checkSearchHealth(workspaceId: string): Promise<SearchHealthStatus> {
    try {
      const result: SearchHealthStatus = {
        status: 'healthy',
        missing_count: 0,
        orphan_count: 0,
        stale_count: 0,
        recommendations: []
      };

      // 1. Check indexed tasks vs real tasks
      const { count: realTaskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      const { count: indexedTaskCount } = await supabase
        .from('search_index')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('entity_type', 'task');

      const missingTasks = (realTaskCount || 0) - (indexedTaskCount || 0);
      
      if (missingTasks > 0) {
        result.missing_count += missingTasks;
        result.recommendations.push(`Missing ${missingTasks} tasks from search index.`);
      } else if (missingTasks < 0) {
        result.orphan_count += Math.abs(missingTasks);
        result.recommendations.push(`Found ${Math.abs(missingTasks)} orphaned task indexes.`);
      }

      // Check for orphan logic directly
      const { data: indexedTasks } = await supabase.from('search_index').select('entity_id').eq('workspace_id', workspaceId).eq('entity_type', 'task');
      const { data: realTasks } = await supabase.from('tasks').select('id').eq('workspace_id', workspaceId);
      
      if (indexedTasks && realTasks) {
        const realSet = new Set(realTasks.map(t => t.id));
        const orphans = indexedTasks.filter(it => !realSet.has(it.entity_id)).length;
        if (orphans > 0) {
          result.orphan_count = orphans;
          if (!result.recommendations.find(r => r.includes('orphaned'))) {
            result.recommendations.push(`Detected ${orphans} explicitly orphaned indexes.`);
          }
        }
      }

      // Determine Status
      const totalIssues = result.missing_count + result.orphan_count + result.stale_count;
      
      if (totalIssues > 100) {
        result.status = 'critical';
      } else if (totalIssues > 0) {
        result.status = 'warning';
      }

      if (totalIssues > 0) {
        result.recommendations.push('Action required: Run Rebuild Search Index.');
      } else {
        result.recommendations.push('Search index is fully synchronized.');
      }

      return result;
    } catch (error) {
      console.error('[searchHealthService.checkSearchHealth] Error:', error);
      return {
        status: 'critical',
        missing_count: 0,
        orphan_count: 0,
        stale_count: 0,
        recommendations: ['Health check failed to complete due to a system error.']
      };
    }
  }
};
