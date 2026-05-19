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
  console.log("WorkspaceProvider: Rendering. Configured:", isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
    console.log("WorkspaceContext: refreshWorkspace() started");
    if (!isSupabaseConfigured) {
      console.log("WorkspaceContext: refreshWorkspace() aborted because Supabase is not configured");
      setWorkspace(null);
      return;
    }

    console.log("WorkspaceContext: refreshWorkspace() calling supabase.auth.getSession()...");
    const { data: { session } } = await supabase.auth.getSession();
    const activeUser = session?.user || null;
    setUser(activeUser);
    console.log("WorkspaceContext: refreshWorkspace() active user:", activeUser?.id || 'none');

    if (!activeUser) {
      setWorkspace(null);
      return;
    }

    try {
      console.log("WorkspaceContext: refreshWorkspace() calling getWorkspaceForUser()...");
      const newWs = await getWorkspaceForUser(activeUser.id);
      console.log("WorkspaceContext: refreshWorkspace() getWorkspaceForUser() returned:", newWs?.id || 'null');
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

    const initialize = async () => {
      console.log("WorkspaceContext: initialize() started");
      setLoading(true);
      setError(null);

      try {
        console.log("WorkspaceContext: calling supabase.auth.getSession()...");
        const { data: { session } } = await supabase.auth.getSession();
        console.log("WorkspaceContext: getSession() resolved, user:", session?.user?.id || 'none');
        if (!active) return;
        setUser(session?.user || null);
        console.log("WorkspaceContext: calling refreshWorkspace()...");
        await refreshWorkspace();
        console.log("WorkspaceContext: refreshWorkspace() resolved successfully");
      } catch (err: any) {
        console.error('WorkspaceContext: initialize() failed with error:', err);
        if (active) setError(err?.message || 'Workspace initialization failed.');
      } finally {
        console.log("WorkspaceContext: initialize() finally block. active:", active);
        if (active) setLoading(false);
      }
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("WorkspaceContext: onAuthStateChange event:", event, "session user:", session?.user?.id || 'none');
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setUser(null);
        setWorkspace(null);
        supabase.removeAllChannels();
      } else {
        setUser(session?.user || null);
        setWorkspace(null);
        await refreshWorkspace();
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
