import { supabase } from '../lib/supabase';
import { sendNotification } from './notificationService';

export interface AIRecommendation {
  id?: string;
  workspace_id: string;
  recommendation_type: string;
  task_id?: string;
  original_assignee_id?: string;
  suggested_assignee_id?: string;
  predicted_eta_improvement: number;
  risk_delta: number;
  confidence_delta: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
}

const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const aiRecommendationService = {
  async createRecommendation(rec: Omit<AIRecommendation, 'status'>): Promise<AIRecommendation> {
    const newRec: AIRecommendation = {
      ...rec,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('ai_recommendations')
          .insert(newRec)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
      }
    }

    // LocalStorage fallback cache
    try {
      const key = `ai_recommendations_${rec.workspace_id}`;
      const cache = JSON.parse(localStorage.getItem(key) || '[]');
      const id = `local-rec-${Date.now()}`;
      const localRec = { id, ...newRec };
      cache.unshift(localRec);
      localStorage.setItem(key, JSON.stringify(cache));
      return localRec;
    } catch (err) {
      console.error("AI Recommendation Error:", {
        source: "aiRecommendationService",
        operation: "createRecommendation_fallback",
        workspace_id: rec.workspace_id,
        timestamp: new Date().toISOString(),
        error: err
      });
      sendNotification(rec.workspace_id, 'system', 'AI Service Failure', 'Failed to generate AI strategy recommendation. Cache unavailable.');
    }

    return newRec;
  },

  async updateRecommendationStatus(
    workspaceId: string,
    id: string,
    status: 'accepted' | 'rejected'
  ): Promise<boolean> {
    if (isSupabaseConfigured && !id.startsWith('local-')) {
      try {
        const { error } = await supabase
          .from('ai_recommendations')
          .update({ status })
          .eq('id', id);
        if (!error) return true;
      } catch (err) {
      }
    }

    try {
      const key = `ai_recommendations_${workspaceId}`;
      const cache: AIRecommendation[] = JSON.parse(localStorage.getItem(key) || '[]');
      const itemIndex = cache.findIndex(r => r.id === id);
      if (itemIndex > -1) {
        cache[itemIndex].status = status;
        localStorage.setItem(key, JSON.stringify(cache));
        return true;
      }
    } catch (err) {
      console.error("AI Recommendation Error:", {
        source: "aiRecommendationService",
        operation: "updateRecommendationStatus_fallback",
        workspace_id: workspaceId,
        timestamp: new Date().toISOString(),
        error: err
      });
      sendNotification(workspaceId, 'system', 'AI Sync Failure', 'Failed to save AI recommendation status. Cache unavailable.');
    }

    return false;
  },

  async fetchRecommendations(workspaceId: string, abortSignal?: AbortSignal): Promise<AIRecommendation[]> {
    if (isSupabaseConfigured) {
      try {
        const query = supabase
          .from('ai_recommendations')
          .select('*').limit(50)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });
          
        if (abortSignal) query.abortSignal(abortSignal);
        
        const { data, error } = await query;
        if (abortSignal?.aborted) return [];
        if (!error && data) return data;
      } catch (err: any) {
        if (err.name === 'AbortError' || abortSignal?.aborted) return [];
      }
    }

    try {
      const key = `ai_recommendations_${workspaceId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (err) {
      console.error("AI Recommendation Error:", {
        source: "aiRecommendationService",
        operation: "fetchRecommendations_fallback",
        workspace_id: workspaceId,
        timestamp: new Date().toISOString(),
        error: err
      });
      return [];
    }
  }
};
