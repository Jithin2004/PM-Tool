import { supabase } from '../lib/supabase';

export interface UniversalSearchResult {
  id: string;
  type: 'project' | 'task' | 'document' | 'user' | 'comment' | 'decision';
  title: string;
  subtitle?: string;
  matchedContext: string;
  lastUpdated: string;
  url: string;
}

export const universalSearchService = {
  async searchWorkspace(query: string, limit: number = 20): Promise<UniversalSearchResult[]> {
    if (!query || query.trim() === '') return [];
    
    try {
      const { data, error } = await supabase.rpc('search_workspace', {
        p_query: query.trim(),
        p_limit: limit
      });
      
      if (error) {
        console.error('[UniversalSearch] Workspace search failed:', error);
        return [];
      }
      
      if (!data) return [];

      return data.map((item: any): UniversalSearchResult => {
        let url = '/workspace';
        let subtitle = '';

        if (item.entity_type === 'project') {
          url = `/projects/${item.entity_id}/board`;
        } else if (item.entity_type === 'task') {
          url = `/execution?task=${item.entity_id}`;
        } else if (item.entity_type === 'document') {
          url = `/workspace?file=${item.entity_id}`;
        } else if (item.entity_type === 'user') {
          url = `/resources/teams?user=${item.entity_id}`;
          subtitle = 'Team Member';
        } else if (item.entity_type === 'comment') {
          url = `/execution?task_comment=${item.entity_id}`;
          subtitle = 'Discussion';
        } else if (item.entity_type === 'decision') {
          url = `/workspace/decisions?decision=${item.entity_id}`;
          subtitle = 'Operational Decision';
        }

        return {
          id: item.entity_id,
          type: item.entity_type as any,
          title: item.title,
          subtitle,
          matchedContext: item.context,
          lastUpdated: item.last_updated,
          url
        };
      });
    } catch (e) {
      console.error('[UniversalSearch] Exception during workspace search:', e);
      return [];
    }
  }
};
