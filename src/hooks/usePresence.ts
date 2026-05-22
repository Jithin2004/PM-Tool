import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface PresenceState {
  onlineAt: string;
  typing?: boolean;
  editing?: string;
}

interface PresenceUser {
  user_id: string;
  username: string;
  online_at: string;
  typing: boolean;
  editing?: string;
}

export function usePresence(wsId: string | undefined) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const track = useCallback((state: Partial<PresenceState>) => {
    if (!channelRef.current) return;
    channelRef.current.track(state);
  }, []);

  const setTyping = useCallback((typing: boolean) => {
    track({ typing });
  }, [track]);

  const setEditing = useCallback((editing: string | undefined) => {
    track({ editing });
  }, [track]);

  useEffect(() => {
    if (!wsId || !isSupabaseConfigured || !profile) return;

    const channel = supabase.channel(`presence:${wsId}`, {
      config: { presence: { key: profile.id } },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const present: PresenceUser[] = [];
        for (const [key, value] of Object.entries(state)) {
          const states = value as any[];
          for (const s of states) {
            present.push({
              user_id: key,
              username: (s as any).username || key.slice(0, 8),
              online_at: (s as any).online_at || new Date().toISOString(),
              typing: (s as any).typing || false,
              editing: (s as any).editing,
            });
          }
        }
        setUsers(present);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: profile.id,
            username: profile.full_name || profile.email || 'User',
            online_at: new Date().toISOString(),
            typing: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [wsId, profile]);

  return { users, setTyping, setEditing, onlineCount: users.length };
}
