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

const IS_SSR = typeof window === 'undefined';

export function useActivityFeed(wsId: string | undefined, limit = 50) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const isAtTopRef = useRef(true);
  const onEventRef = useRef<((payload: any) => void) | undefined>(undefined);

  useEffect(() => {
    if (!wsId || !isSupabaseConfigured || IS_SSR) { setLoading(false); return; }

    const aborted = { current: false };

    supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (aborted.current) return;
        if (error) { setError(error.message); }
        else { setEntries((data || []).reverse()); }
        setLoading(false);
      });

    return () => { aborted.current = true; };
  }, [wsId, limit]);

  const handleRealtimeEvent = useCallback((payload: any) => {
    const entry = payload.new as ActivityEntry;
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > limit ? next.slice(next.length - limit) : next;
    });
    if (feedRef.current && isAtTopRef.current) {
      requestAnimationFrame(() => {
        feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, [limit]);

  onEventRef.current = handleRealtimeEvent;

  useActivityRealtime(wsId, useCallback((payload) => {
    onEventRef.current?.(payload);
  }, []));

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const atTop = feedRef.current.scrollTop < 50;
    isAtTopRef.current = atTop;
    setIsAtTop(atTop);
  }, []);

  return { entries, loading, error, feedRef, isAtTop, handleScroll };
}
