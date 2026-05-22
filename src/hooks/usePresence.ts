import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface PresenceState {
  online_at: string;
  typing?: boolean;
  editing?: string;
  last_active_at: string;
}

interface PresenceUser {
  user_id: string;
  username: string;
  online_at: string;
  last_active_at: string;
  typing: boolean;
  editing?: string;
  idle: boolean;
}

const IDLE_THRESHOLD_MS = 120_000;
const HEARTBEAT_MS = 30_000;

export function usePresence(wsId: string | undefined) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!channelRef.current) return;
    channelRef.current.track({ last_active_at: new Date().toISOString() });
  }, []);

  const track = useCallback((state: Partial<PresenceState>) => {
    if (!channelRef.current) return;
    markActive();
    channelRef.current.track(state);
  }, [markActive]);

  const setTyping = useCallback((typing: boolean) => {
    track({ typing });
  }, [track]);

  const setEditing = useCallback((editing: string | undefined) => {
    track({ editing });
  }, [track]);

  // Global activity listeners for idle detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlers = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    const onActivity = () => { lastActivityRef.current = Date.now(); markActive(); };
    handlers.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => handlers.forEach((e) => window.removeEventListener(e, onActivity));
  }, [markActive]);

  useEffect(() => {
    if (!wsId || !isSupabaseConfigured || !profile) return;

    const channel = supabase.channel(`presence:${wsId}`, {
      config: { presence: { key: profile.id } },
    });

    channelRef.current = channel;

    const joinPayload = {
      user_id: profile.id,
      username: profile.full_name || profile.email || 'User',
      online_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      typing: false,
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const now = Date.now();
        const present: PresenceUser[] = [];
        for (const [key, value] of Object.entries(state)) {
          const states = value as any[];
          for (const s of states) {
            const lastActive = (s as any).last_active_at || (s as any).online_at || new Date().toISOString();
            const lastActiveMs = new Date(lastActive).getTime();
            present.push({
              user_id: key,
              username: (s as any).username || key.slice(0, 8),
              online_at: (s as any).online_at || new Date().toISOString(),
              last_active_at: lastActive,
              typing: (s as any).typing || false,
              editing: (s as any).editing,
              idle: (now - lastActiveMs) > IDLE_THRESHOLD_MS,
            });
          }
        }
        setUsers(present);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(joinPayload);
        }
      });

    // Heartbeat to refresh presence
    heartbeatRef.current = window.setInterval(() => {
      if (channelRef.current) {
        channelRef.current.track({
          ...joinPayload,
          last_active_at: new Date().toISOString(),
        });
      }
    }, HEARTBEAT_MS);

    // Idle detection interval
    idleTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > IDLE_THRESHOLD_MS && channelRef.current) {
        channelRef.current.track({
          ...joinPayload,
          last_active_at: new Date(lastActivityRef.current).toISOString(),
        });
      }
    }, IDLE_THRESHOLD_MS);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      if (idleTimerRef.current) window.clearInterval(idleTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [wsId, profile]);

  return { users, setTyping, setEditing, onlineCount: users.length, markActive };
}
