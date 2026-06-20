import { supabase } from '../lib/supabase';
import { searchIndexService } from './searchIndexService';

export const searchSyncService = {
  async rebuildWorkspaceIndex(
    workspaceId: string, 
    onProgress?: (current: number, total: number, phase: string) => void
  ): Promise<boolean> {
    try {
      if (onProgress) onProgress(0, 100, 'Clearing existing index');
      
      // We don't wipe the index outright, we'll upsert safely to maintain idempotency
      // but in a true rebuild we might want to delete first. For safety, we just overwrite.

      const entities = [
        { table: 'tasks', type: 'task', idCol: 'id', titleCol: 'title', contentCol: 'description' },
        { table: 'projects', type: 'project', idCol: 'id', titleCol: 'name', contentCol: 'description' },
        { table: 'epics', type: 'epic', idCol: 'id', titleCol: 'title', contentCol: 'description' },
        { table: 'documents', type: 'document', idCol: 'id', titleCol: 'title', contentCol: 'description' },
        { table: 'users', type: 'user', idCol: 'id', titleCol: 'full_name', contentCol: 'email' }
      ];

      let totalSynced = 0;
      let totalEntitiesToProcess = 500; // rough estimate for progress bar

      for (const entity of entities) {
        if (onProgress) onProgress(totalSynced, totalEntitiesToProcess, `Syncing ${entity.table}`);
        
        let hasMore = true;
        let lastId = '00000000-0000-0000-0000-000000000000';
        
        while (hasMore) {
          const { data, error } = await supabase
            .from(entity.table)
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('id')
            .gt('id', lastId)
            .limit(100);
            
          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          const payloads = data.map(item => ({
            workspace_id: workspaceId,
            entity_type: entity.type,
            entity_id: item[entity.idCol],
            title: item[entity.titleCol] || `${entity.type} item`,
            content: item[entity.contentCol] || '',
            metadata: { uid: item.uid || item.uid_code || item.project_code }
          }));

          const { error: upsertError } = await supabase
            .from('search_index')
            .upsert(payloads, { onConflict: 'entity_type,entity_id' });

          if (upsertError) throw upsertError;

          lastId = data[data.length - 1].id;
          totalSynced += data.length;
          if (onProgress) onProgress(totalSynced, Math.max(totalSynced + 50, totalEntitiesToProcess), `Syncing ${entity.table}`);
        }
      }

      if (onProgress) onProgress(totalSynced, totalSynced, 'Rebuild complete');
      return true;

    } catch (err) {
      console.error('[searchSyncService.rebuildWorkspaceIndex] Error:', err);
      return false;
    }
  },

  async syncMissingIndexes(workspaceId: string): Promise<number> {
    // A lighter version of rebuild that only inserts what's missing
    // In PostgreSQL, this would ideally be done via a server-side RPC diff.
    // For now, we will piggyback off the rebuild logic but it upserts anyway.
    await this.rebuildWorkspaceIndex(workspaceId);
    return 1;
  },

  async removeOrphanIndexes(workspaceId: string): Promise<number> {
    try {
      // Find all tasks in index
      const { data: indexedTasks } = await supabase.from('search_index').select('entity_id').eq('workspace_id', workspaceId).eq('entity_type', 'task');
      if (!indexedTasks) return 0;
      
      const { data: realTasks } = await supabase.from('tasks').select('id').eq('workspace_id', workspaceId);
      const realSet = new Set(realTasks?.map(t => t.id) || []);
      
      const orphans = indexedTasks.filter(it => !realSet.has(it.entity_id)).map(it => it.entity_id);
      
      if (orphans.length > 0) {
        await supabase.from('search_index').delete().eq('entity_type', 'task').in('entity_id', orphans);
      }
      
      return orphans.length;
    } catch (err) {
      console.error('[searchSyncService.removeOrphanIndexes] Error:', err);
      return 0;
    }
  }
};
