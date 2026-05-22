import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, createRealtimeChannel } from '../lib/supabase';
import type { Sprint } from '../types';

export function useSprints(workspaceId?: string, projectId?: string) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSprints = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured) { setSprints([]); setLoading(false); return; }
    try {
      setLoading(true);
      let query = supabase.from('sprints').select('*').eq('workspace_id', workspaceId).order('start_date', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (!error && data) setSprints(data as Sprint[]);
    } catch (e) {
      console.error('useSprints: fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    fetchSprints();
    if (workspaceId && isSupabaseConfigured) {
      const channel = createRealtimeChannel(`sprints-${workspaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') setSprints(prev => [payload.new as Sprint, ...prev]);
          else if (payload.eventType === 'UPDATE') setSprints(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
          else if (payload.eventType === 'DELETE') setSprints(prev => prev.filter(s => s.id !== payload.old.id));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchSprints, workspaceId]);

  return { sprints, loading, fetchSprints };
}
