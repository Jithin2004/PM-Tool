import { supabase } from '../lib/supabase';

export interface SearchIndexPayload {
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  content?: string;
  keywords?: Record<string, any>;
  metadata?: Record<string, any>;
}

export const searchIndexService = {
  async indexEntity(payload: SearchIndexPayload): Promise<boolean> {
    const { error } = await supabase
      .from('search_index')
      .upsert({
        workspace_id: payload.workspace_id,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        title: payload.title,
        content: payload.content || '',
        keywords: payload.keywords || {},
        metadata: payload.metadata || {},
        // Postgres triggers calculate search_vector behind the scenes, or we let plain text fallback work.
        // Actually, for pg_trgm and basic tsvector, Supabase usually requires a trigger. 
        // We will just let the DB handle it if configured, otherwise search_workspace does ILIKE / plainto_tsquery.
      }, { onConflict: 'entity_type,entity_id' });

    if (error) {
      console.error('[searchIndexService.indexEntity] Error:', error);
      return false;
    }
    return true;
  },

  async removeEntity(entityType: string, entityId: string): Promise<boolean> {
    const { error } = await supabase
      .from('search_index')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      console.error('[searchIndexService.removeEntity] Error:', error);
      return false;
    }
    return true;
  },

  async updateEntity(entityType: string, entityId: string, updates: Partial<SearchIndexPayload>): Promise<boolean> {
    const { error } = await supabase
      .from('search_index')
      .update(updates)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      console.error('[searchIndexService.updateEntity] Error:', error);
      return false;
    }
    return true;
  },

  async trackRecentEntity(workspaceId: string, userId: string, entityType: string, entityId: string): Promise<boolean> {
    const { error } = await supabase
      .from('recent_entities')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        opened_at: new Date().toISOString()
      }, { onConflict: 'user_id,entity_type,entity_id' });

    if (error) {
      console.error('[searchIndexService.trackRecentEntity] Error:', error);
      return false;
    }
    return true;
  },

  async getRecentEntities(workspaceId: string, userId: string, limit = 5) {
    const { data, error } = await supabase
      .from('recent_entities')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[searchIndexService.getRecentEntities] Error:', error);
      return [];
    }
    return data || [];
  },

  async searchWorkspace(workspaceId: string, query: string, filters: string[] = [], limit = 20) {
    const { data, error } = await supabase
      .rpc('search_workspace', {
        query_text: query,
        search_workspace_id: workspaceId,
        entity_filters: filters.length > 0 ? filters : null,
        limit_count: limit
      });

    if (error) {
      console.error('[searchIndexService.searchWorkspace] Error:', error);
      return [];
    }
    return data || [];
  },

  async indexIntegrationConnection(workspaceId: string, integrationId: string, provider: string, status: string) {
    await this.indexEntity({
      workspace_id: workspaceId,
      entity_type: 'integration',
      entity_id: integrationId,
      title: `Integration: ${provider}`,
      content: `Status: ${status}`,
      metadata: { provider, status }
    });
  },

  async indexWebhookEndpoint(workspaceId: string, webhookId: string, name: string) {
    await this.indexEntity({
      workspace_id: workspaceId,
      entity_type: 'webhook',
      entity_id: webhookId,
      title: `Webhook: ${name}`,
      content: 'Custom webhook endpoint'
    });
  },

  async indexIntegrationError(workspaceId: string, eventId: string, provider: string, errorMessage: string) {
    await this.indexEntity({
      workspace_id: workspaceId,
      entity_type: 'integration_error',
      entity_id: eventId,
      title: `Integration Error: ${provider}`,
      content: errorMessage
    });
  }
};
