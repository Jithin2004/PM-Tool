import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, createRealtimeChannel } from '../lib/supabase';
import type { Meeting } from '../types';

export function useMeetings(workspaceId?: string, projectId?: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured) { setMeetings([]); setLoading(false); return; }
    try {
      setLoading(true);
      let query = supabase.from('meetings').select('*').eq('workspace_id', workspaceId).order('start_time', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (!error && data) setMeetings(data as Meeting[]);
    } catch (e) {
      console.error('useMeetings: fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    fetchMeetings();
    if (workspaceId && isSupabaseConfigured) {
      const channel = createRealtimeChannel(`meetings-${workspaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') setMeetings(prev => [payload.new as Meeting, ...prev]);
          else if (payload.eventType === 'UPDATE') setMeetings(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          else if (payload.eventType === 'DELETE') setMeetings(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchMeetings, workspaceId]);

  return { meetings, loading, fetchMeetings };
}
