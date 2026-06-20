import { supabase } from '../lib/supabase';

export interface UserLearningState {
  id: string;
  workspace_id: string;
  user_id: string;
  dismissed_guides: string[];
  completed_tips: string[];
  created_at: string;
  updated_at: string;
}

class LearningStateService {
  private cache = new Map<string, UserLearningState>();

  private cacheKey(workspaceId: string, userId: string) {
    return `${workspaceId}:${userId}`;
  }

  async getState(workspaceId: string, userId: string): Promise<UserLearningState | null> {
    const key = this.cacheKey(workspaceId, userId);
    if (this.cache.has(key)) return this.cache.get(key)!;

    try {
      const { data, error } = await supabase
        .from('user_learning_state')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[learningStateService] getState error:', error.message);
        return null;
      }
      if (data) {
        this.cache.set(key, data as UserLearningState);
      }
      return data as UserLearningState | null;
    } catch (err) {
      console.error('[learningStateService] getState failed:', err);
      return null;
    }
  }

  /**
   * Returns true if a guide with the given ID has been dismissed by this user.
   */
  async isGuideDismissed(workspaceId: string, userId: string, guideId: string): Promise<boolean> {
    const state = await this.getState(workspaceId, userId);
    return state?.dismissed_guides?.includes(guideId) ?? false;
  }

  /**
   * Dismiss a contextual guide — stored in user_learning_state.dismissed_guides.
   * Idempotent: safe to call multiple times.
   */
  async dismissGuide(workspaceId: string, userId: string, guideId: string): Promise<void> {
    const key = this.cacheKey(workspaceId, userId);
    const state = await this.getState(workspaceId, userId);

    const currentDismissed: string[] = state?.dismissed_guides ?? [];
    if (currentDismissed.includes(guideId)) return;

    const updatedDismissed = [...currentDismissed, guideId];
    const currentTips: string[] = state?.completed_tips ?? [];

    try {
      const { data, error } = await supabase
        .from('user_learning_state')
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            dismissed_guides: updatedDismissed,
            completed_tips: currentTips,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,user_id' }
        )
        .select()
        .maybeSingle();

      if (!error && data) {
        this.cache.set(key, data as UserLearningState);
      }
    } catch (err) {
      console.error('[learningStateService] dismissGuide failed:', err);
    }

    // Optimistically update cache
    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      this.cache.set(key, { ...cached, dismissed_guides: updatedDismissed });
    }
  }

  /**
   * Mark a tip as completed.
   */
  async completeTip(workspaceId: string, userId: string, tipId: string): Promise<void> {
    const key = this.cacheKey(workspaceId, userId);
    const state = await this.getState(workspaceId, userId);

    const currentTips: string[] = state?.completed_tips ?? [];
    if (currentTips.includes(tipId)) return;

    const updatedTips = [...currentTips, tipId];
    const currentDismissed: string[] = state?.dismissed_guides ?? [];

    try {
      await supabase
        .from('user_learning_state')
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            dismissed_guides: currentDismissed,
            completed_tips: updatedTips,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,user_id' }
        );

      if (this.cache.has(key)) {
        const cached = this.cache.get(key)!;
        this.cache.set(key, { ...cached, completed_tips: updatedTips });
      }
    } catch (err) {
      console.error('[learningStateService] completeTip failed:', err);
    }
  }

  /** Clear in-memory cache for a user (e.g., on logout) */
  clearCache(workspaceId: string, userId: string) {
    this.cache.delete(this.cacheKey(workspaceId, userId));
  }
}

export const learningStateService = new LearningStateService();
