import { supabase, createRealtimeChannel, isSupabaseConfigured } from '../lib/supabase';
import { fetchNotifications } from './notificationService';
import type { Notification } from '../types';

/** Row shape from the notifications table — aliased to the canonical Notification type. */
export type NotificationRow = Notification;

export async function loadWorkspaceNotifications(
  workspaceId: string,
  userId?: string,
): Promise<NotificationRow[]> {
  return fetchNotifications(workspaceId, userId);
}

export function subscribeToWorkspaceNotifications(
  workspaceId: string,
  userId: string | undefined,
  onInsert: (notification: NotificationRow) => void,
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel = createRealtimeChannel(`notifications-changes-${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      payload => {
        const row = payload.new as NotificationRow;
        if (!row.user_id || row.user_id === userId) {
          onInsert(row);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
