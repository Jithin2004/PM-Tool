import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dedupPayload } from '../lib/realtimeDedup';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtimeOrchestrator } from '../services/realtimeOrchestrator';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: string;
  event?: EventType;
  filter?: string;
  onChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

export function useRealtime({ table, event = '*', filter, onChange, enabled = true }: UseRealtimeOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setStatus('error');
      return;
    }

    const channelId = `realtime:${table}:${filter || 'all'}`;
    
    const unsubscribe = realtimeOrchestrator.subscribe(
      channelId,
      table,
      filter || '',
      (payload) => {
        if (event === '*' || payload.eventType === event) {
          dedupPayload(payload, () => onChangeRef.current(payload));
        }
      }
    );

    setStatus('connected');

    return () => {
      unsubscribe();
      setStatus('error');
    };
  }, [table, event, filter, enabled]);

  return status;
}

export function useActivityRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'activity_logs',
    event: 'INSERT',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

export function useTasksRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'tasks',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

export function useApprovalsRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'approval_instances',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

// RC4 Additions
export function useNotificationsRealtime(wsId: string | undefined, userId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'notification_events',
    filter: wsId && userId ? `workspace_id=eq.${wsId}` : undefined, // RLS handles user scoped, but filter helps if RLS is bypassed via realtime. Or we can filter here.
    onChange: (payload) => {
      if (payload.new && payload.new.user_id !== userId) return;
      onEvent(payload);
    },
    enabled: !!wsId && !!userId,
  });
}

export function useCommentsRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'entity_comments',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

export function useDocumentsRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'documents',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

export function useFileEventsRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'file_events',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}

export function useIntegrationEventsRealtime(wsId: string | undefined, onEvent: (payload: RealtimePostgresChangesPayload<any>) => void) {
  return useRealtime({
    table: 'integration_events',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    onChange: onEvent,
    enabled: !!wsId,
  });
}
