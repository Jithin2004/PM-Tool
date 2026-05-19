import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createWorkspaceForUser, getWorkspaceForUser, updateWorkspaceSettings as persistWorkspaceSettings } from '../services/workspaceService';
import type { Workspace, WorkspaceSettings } from '../types/workspace';

interface WorkspaceContextValue {
  user: User | null;
  workspace: Workspace | null;
  settings: WorkspaceSettings | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface CreateWorkspaceInput {
  name: string;
  settings: WorkspaceSettings;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async (targetUser?: User | null) => {
    if (import.meta.env.DEV) {
      console.log("WorkspaceContext: refreshWorkspace() started");
    }
    if (!isSupabaseConfigured) {
      if (import.meta.env.DEV) {
        console.log("WorkspaceContext: refreshWorkspace() aborted because Supabase is not configured");
      }
      setWorkspace(null);
      return;
    }

    let activeUser = targetUser;
    if (activeUser === undefined) {
      if (import.meta.env.DEV) {
        console.log("WorkspaceContext: refreshWorkspace() calling supabase.auth.getSession()...");
      }
      const { data: { session } } = await supabase.auth.getSession();
      activeUser = session?.user || null;
    }
    setUser(activeUser);
    if (import.meta.env.DEV) {
      console.log("WorkspaceContext: refreshWorkspace() active user:", activeUser?.id || 'none');
    }

    if (!activeUser) {
      setWorkspace(null);
      return;
    }

    try {
      if (import.meta.env.DEV) {
        console.log("WorkspaceContext: refreshWorkspace() calling getWorkspaceForUser()...");
      }
      const newWs = await getWorkspaceForUser(activeUser.id);
      if (import.meta.env.DEV) {
        console.log("WorkspaceContext: refreshWorkspace() getWorkspaceForUser() returned:", newWs?.id || 'null');
      }
      setWorkspace(prev => {
        if (prev && newWs && prev.id !== newWs.id) {
          console.log('Workspace switch detected. Unsubscribing stale channels.');
          supabase.removeAllChannels();
        }
        return newWs;
      });
    } catch (err: any) {
      console.error('WorkspaceContext: refreshWorkspace() failed:', err);
      setWorkspace(null);
      setError(err?.message || 'Workspace lookup failed.');
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const initWorkspace = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log("WorkspaceContext: Initializing workspace state...");
        }
        await refreshWorkspace();
      } catch (err) {
        console.error("WorkspaceContext initialization error:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    // Run explicit initialization to guarantee loading resolves
    initWorkspace();

    if (import.meta.env.DEV) {
      console.log("WorkspaceContext: subscribing to onAuthStateChange...");
    }
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (import.meta.env.DEV) {
        console.log("WorkspaceContext: onAuthStateChange event:", event, "session user:", session?.user?.id || 'none');
      }
      if (!active) return;

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setUser(null);
        setWorkspace(null);
        supabase.removeAllChannels();
        setLoading(false);
      } else if (event !== 'INITIAL_SESSION') {
        // Only react to subsequent events, as INITIAL_SESSION is handled by explicit init
        const userToRefresh = session?.user || null;
        setUser(userToRefresh);
        await refreshWorkspace(userToRefresh);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [refreshWorkspace]);

  const createWorkspace = useCallback(async ({ name, settings }: CreateWorkspaceInput) => {
    if (!user) throw new Error('You must be signed in to create a workspace.');
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

    setError(null);

    try {
      const nextWorkspace = await createWorkspaceForUser({ name, settings, user });
      setWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (err: any) {
      setError(err?.message || 'Workspace creation failed.');
      throw err;
    }
  }, [user]);

  const updateWorkspaceSettings = useCallback(async (settings: Partial<WorkspaceSettings>) => {
    if (!workspace) throw new Error('No workspace is active.');

    try {
      setWorkspace(await persistWorkspaceSettings(workspace, settings));
    } catch (err: any) {
      setError(err?.message || 'Workspace update failed.');
      throw err;
    }
  }, [workspace]);

  const signInWithGoogle = useCallback(async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setWorkspace(null);
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    user,
    workspace,
    settings: workspace?.settings || null,
    loading,
    error,
    refreshWorkspace,
    createWorkspace,
    updateWorkspaceSettings,
    signInWithGoogle,
    signOut
  }), [user, workspace, loading, error, refreshWorkspace, createWorkspace, updateWorkspaceSettings, signInWithGoogle, signOut]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider.');
  }
  return context;
}
