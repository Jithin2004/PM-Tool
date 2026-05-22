import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useActivityRealtime } from './useRealtime';

interface ActivityEntry {
  id: string;
  actor_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  actor_name?: string;
}

export function useActivityFeed(wsId: string | undefined, limit = 50) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    if (!wsId || !isSupabaseConfigured) { setLoading(false); return; }

    supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) { setError(error.message); }
        else { setEntries((data || []).reverse()); }
        setLoading(false);
      });
  }, [wsId, limit]);

  useActivityRealtime(wsId, useCallback((payload) => {
    const entry = payload.new as ActivityEntry;
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > limit ? next.slice(next.length - limit) : next;
    });
    if (feedRef.current && isAtTop) {
      requestAnimationFrame(() => {
        feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, [limit, isAtTop]));

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    setIsAtTop(feedRef.current.scrollTop < 50);
  }, []);

  return { entries, loading, error, feedRef, isAtTop, handleScroll };
}
