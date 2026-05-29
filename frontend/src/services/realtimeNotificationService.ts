import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeOrchestrator } from './realtimeOrchestrator';
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

  const unsubscribe = realtimeOrchestrator.subscribe(
    `notifications-changes-${workspaceId}`,
    'notifications',
    `workspace_id=eq.${workspaceId}`,
    (payload) => {
      if (payload.eventType === 'INSERT') {
        const row = payload.new as NotificationRow;
        if (!row.user_id || row.user_id === userId) {
          onInsert(row);
        }
      }
    }
  );

  return () => {
    unsubscribe();
  };
}
