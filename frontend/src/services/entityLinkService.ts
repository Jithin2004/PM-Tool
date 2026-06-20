import { supabase } from '../lib/supabase';

export interface EntityLink {
  id: string;
  workspace_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export const entityLinkService = {
  async createLink(link: Omit<EntityLink, 'id' | 'created_at'>): Promise<EntityLink | null> {
    const { data, error } = await supabase
      .from('entity_links')
      .insert({
        id: crypto.randomUUID(),
        ...link,
      })
      .select()
      .single();

    if (error) {
      console.error('[entityLinkService.createLink] Error:', error);
      return null;
    }
    return data;
  },

  async removeLink(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('entity_links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[entityLinkService.removeLink] Error:', error);
      return false;
    }
    return true;
  },

  async getEntityLinks(entityType: string, entityId: string): Promise<EntityLink[]> {
    const { data, error } = await supabase
      .from('entity_links')
      .select('*')
      .or(`and(source_type.eq.${entityType},source_id.eq.${entityId}),and(target_type.eq.${entityType},target_id.eq.${entityId})`);

    if (error) {
      console.error('[entityLinkService.getEntityLinks] Error:', error);
      return [];
    }
    return data || [];
  },

  async getRelatedEntities(entityType: string, entityId: string, relationshipType?: string): Promise<EntityLink[]> {
    let query = supabase
      .from('entity_links')
      .select('*')
      .or(`and(source_type.eq.${entityType},source_id.eq.${entityId}),and(target_type.eq.${entityType},target_id.eq.${entityId})`);

    if (relationshipType) {
      query = query.eq('relationship_type', relationshipType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[entityLinkService.getRelatedEntities] Error:', error);
      return [];
    }
    return data || [];
  }
};
