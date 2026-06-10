import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useOperationalData } from './OperationalDataContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({ isConnected: false });

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspace() as any;
  const { profile } = useAuth();
  const { refreshAll } = useOperationalData() as any;
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !workspace?.id || !profile?.id) return;

    // We can scope the channel to the workspace to only listen for changes relevant to us.
    const channelName = `workspace_${workspace.id}`;
    
    const channel = supabase.channel(channelName);

    // To prevent the person who caused the mutation from double-fetching, 
    // we could check the user ID if the payloads contained an actor_id, 
    // but for simplicity and safety we'll just invalidate the cache and let react-query or our context re-fetch.
    
    const handleUpdate = (payload: any) => {
      // In a real production app with React Query, we would invalidate specific queries:
      // queryClient.invalidateQueries(['tasks'])
      // But here we rely on the operational data context refresh
      if (refreshAll) {
        refreshAll();
      }
    };

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `workspace_id=eq.${workspace.id}` }, handleUpdate)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace?.id, profile?.id, refreshAll]);

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);
