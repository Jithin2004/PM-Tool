import { supabase } from '../../lib/supabase';
import { activityEventService } from '../../services/activityEventService';

export const watcherEngine = {
  async addWatcher(workspaceId: string, entityType: string, entityId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('entity_watchers')
      .upsert({
        workspace_id: workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId
      }, { onConflict: 'entity_type, entity_id, user_id' });

    if (error) {
      console.error('[watcherEngine.addWatcher]', error);
      return false;
    }
    return true;
  },

  async removeWatcher(entityType: string, entityId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('entity_watchers')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('user_id', userId);

    if (error) {
      console.error('[watcherEngine.removeWatcher]', error);
      return false;
    }
    return true;
  },

  async getWatchers(entityType: string, entityId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('entity_watchers')
      .select('user_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error || !data) return [];
    return data.map(d => d.user_id);
  },

  async isWatching(entityType: string, entityId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('entity_watchers')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('user_id', userId)
      .single();

    if (error) return false;
    return !!data;
  },

  async autoWatch(workspaceId: string, entityType: string, entityId: string, authorId: string) {
    // Creator is always a watcher
    await this.addWatcher(workspaceId, entityType, entityId, authorId);
  }
};
