import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityEventService } from './activityEventService';
import { entityLinkService } from './entityLinkService';
import { Story } from '../core/types/cycle';
import { uidService } from './uidService';

export interface CreateStoryInput {
  workspace_id: string;
  project_id: string;
  epic_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  priority?: string;
  actorId?: string;
}

export const storyService = {
  async getProjectStories(projectId: string): Promise<Story[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[storyService.getProjectStories] Error:', error);
      return [];
    }
    return data || [];
  },

  async createStory(input: CreateStoryInput): Promise<Story | null> {
    if (!isSupabaseConfigured) return null;
    
    try {
      // 1. Resolve UID scope from epic
      const { data: epic } = await supabase.from('epics').select('uid_code').eq('id', input.epic_id).single();
      const scopeCode = epic?.uid_code || 'PRJ'; // Fallback if epic has no code, though it should

      const nextUid = await uidService.generateNextUID(input.workspace_id, 'epic', scopeCode);
      if (!nextUid) throw new Error('Failed to generate UID for story');

      // 2. Create Story
      const { data, error } = await supabase
        .from('stories')
        .insert({
          workspace_id: input.workspace_id,
          project_id: input.project_id,
          epic_id: input.epic_id,
          uid: nextUid,
          title: input.title,
          description: input.description || '',
          status: 'backlog',
          created_by: input.actorId
        })
        .select()
        .single();

      if (error || !data) throw error;

      // 3. Create Entity Link (DO NOT create story belongs_to epic per rules because epic_id exists. Just linking if needed. Wait, prompt says: "DO NOT create Story belongs_to Epic because story.epic_id already exists... Use entity_links only for flexible relations". So skip linking here).

      // 4. Record Activity
      await activityEventService.recordActivity({
        workspace_id: input.workspace_id,
        actor_id: input.actorId,
        entity_type: 'story',
        entity_id: data.id,
        action_type: 'story_created',
        after_value: { title: input.title, uid: nextUid, epic_id: input.epic_id }
      });

      return data;
    } catch (err) {
      console.error('[storyService.createStory] Error:', err);
      return null;
    }
  }
};
