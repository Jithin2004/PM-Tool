import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ActivityEventEntry {
  id: string;
  workspace_id: string;
  user_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  verb: string;
  title: string;
  description?: string;
  severity: string;
  importance: string;
  icon_key: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  device?: string;
  workspace_timezone?: string;
  display_time: string;
  created_at: string;
  is_system: boolean;
  visibility: 'public' | 'admin' | 'private';
  origin: string;
  module: string;
  event_hash?: string;
}

const IS_SSR = typeof window === 'undefined';

export function useActivityFeed(wsId: string | undefined, limit = 50) {
  const [entries, setEntries] = useState<ActivityEventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  
  const feedRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const isAtTopRef = useRef(true);

  // Base query function
  const fetchEvents = useCallback(async (cursor?: string, search?: string, mod?: string) => {
    if (!wsId || !isSupabaseConfigured || IS_SSR) return [];
    
    let query = supabase
      .from('activity_events')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    if (mod) {
      query = query.eq('module', mod);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,actor_name.ilike.%${search}%,verb.ilike.%${search}%,entity_type.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      return [];
    }
    return data as ActivityEventEntry[];
  }, [wsId, limit]);

  // Initial load and query change
  useEffect(() => {
    if (!wsId || !isSupabaseConfigured || IS_SSR) { setLoading(false); return; }
    
    let active = true;
    setLoading(true);
    setError(null);
    
    fetchEvents(undefined, searchQuery, filterModule).then(data => {
      if (!active) return;
      setEntries(data);
      setHasMore(data.length === limit);
      setLoading(false);
    });

    return () => { active = false; };
  }, [wsId, fetchEvents, searchQuery, filterModule, limit]);

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || entries.length === 0) return;
    setLoadingMore(true);
    const lastItem = entries[entries.length - 1];
    const nextData = await fetchEvents(lastItem.created_at, searchQuery, filterModule);
    setEntries(prev => [...prev, ...nextData]);
    setHasMore(nextData.length === limit);
    setLoadingMore(false);
  }, [entries, fetchEvents, hasMore, loadingMore, searchQuery, filterModule, limit]);

  // Set up realtime Supabase channel subscription
  useEffect(() => {
    if (!wsId || !isSupabaseConfigured || IS_SSR) return;

    const channel = supabase
      .channel(`public:activity_events:workspace:${wsId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
        filter: `workspace_id=eq.${wsId}`
      }, (payload) => {
        const newEvent = payload.new as ActivityEventEntry;
        
        let matches = true;
        if (filterModule && newEvent.module !== filterModule) matches = false;
        if (searchQuery) {
          const queryLower = searchQuery.toLowerCase();
          const titleMatch = newEvent.title?.toLowerCase().includes(queryLower);
          const descMatch = newEvent.description?.toLowerCase().includes(queryLower);
          const actorMatch = newEvent.actor_name?.toLowerCase().includes(queryLower);
          const verbMatch = newEvent.verb?.toLowerCase().includes(queryLower);
          const entityMatch = newEvent.entity_type?.toLowerCase().includes(queryLower);
          if (!titleMatch && !descMatch && !actorMatch && !verbMatch && !entityMatch) {
            matches = false;
          }
        }

        if (matches) {
          setEntries(prev => {
            if (prev.some(x => x.id === newEvent.id || (newEvent.event_hash && x.event_hash === newEvent.event_hash))) {
              return prev;
            }
            return [newEvent, ...prev];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wsId, searchQuery, filterModule]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const atTop = feedRef.current.scrollTop < 50;
    isAtTopRef.current = atTop;
    setIsAtTop(atTop);
  }, []);

  return {
    entries,
    loading,
    loadingMore,
    hasMore,
    error,
    feedRef,
    isAtTop,
    handleScroll,
    loadMore,
    searchQuery,
    setSearchQuery,
    filterModule,
    setFilterModule
  };
}
