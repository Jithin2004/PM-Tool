import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createRealtimeChannel } from '../../lib/supabase';
import type { OperationalPresence, OperationalContext } from './types';

type PresenceCallback = {
  onJoin?: (presence: OperationalPresence) => void;
  onLeave?: (userId: string) => void;
  onUpdate?: (presence: OperationalPresence) => void;
};

function buildChannelName(context: OperationalContext): string {
  const parts = ['presence'];
  if (context.projectId) parts.push(`project:${context.projectId}`);
  if (context.sprintId) parts.push(`sprint:${context.sprintId}`);
  if (context.epicId) parts.push(`epic:${context.epicId}`);
  if (context.taskId) parts.push(`task:${context.taskId}`);
  return parts.join('/');
}

export function useScopedPresenceSubscription(
  context: OperationalContext,
  myPresence: OperationalPresence,
  callbacks: PresenceCallback,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { onJoin, onLeave, onUpdate } = callbacks;

  const channelName = buildChannelName(context);

  useEffect(() => {
    if (!context.projectId) return;

    const channel = createRealtimeChannel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        for (const [userId, presences] of Object.entries(state)) {
          const presence = (presences as any[])[0] as unknown as OperationalPresence | undefined;
          if (presence) {
            onUpdate?.(presence);
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presence = newPresences?.[0] as unknown as OperationalPresence | undefined;
        if (presence && presence.userId !== myPresence.userId) {
          onJoin?.(presence);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const presence = leftPresences?.[0] as unknown as OperationalPresence | undefined;
        if (presence) {
          onLeave?.(presence.userId);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myPresence);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [channelName, context.projectId]);

  const updateMyPresence = useCallback(async (presence: OperationalPresence) => {
    if (channelRef.current) {
      await channelRef.current.track(presence);
    }
  }, []);

  return { updateMyPresence };
}
