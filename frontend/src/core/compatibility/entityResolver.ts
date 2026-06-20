import { supabase } from '../../lib/supabase';

export interface ResolvedEntity {
  type: string;
  id: string;
  name?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export const entityResolver = {
  async resolveEntity(type: string, id: string): Promise<ResolvedEntity | null> {
    try {
      let table = '';
      let nameField = 'name';
      let pathPrefix = '';

      switch (type) {
        case 'task':
          table = 'tasks';
          pathPrefix = '/execution/board?task=';
          break;
        case 'project':
          table = 'projects';
          pathPrefix = '/workspace?project=';
          break;
        case 'epic':
          table = 'epics';
          break;
        case 'document':
        case 'file':
          table = 'files';
          pathPrefix = '/workspace/documents?file=';
          break;
        case 'user':
          table = 'users';
          nameField = 'full_name';
          pathPrefix = '/resources/teams?user=';
          break;
        default:
          console.warn(`[entityResolver] Unknown entity type: ${type}`);
          return { type, id };
      }

      const { data, error } = await supabase
        .from(table)
        .select(`id, ${nameField}`)
        .eq('id', id)
        .single();

      if (error || !data) {
        return { type, id };
      }

      return {
        type,
        id,
        name: data[nameField] as string,
        url: pathPrefix ? `${pathPrefix}${id}` : undefined,
      };
    } catch (err) {
      console.error('[entityResolver] Resolution failed', err);
      return { type, id };
    }
  }
};
