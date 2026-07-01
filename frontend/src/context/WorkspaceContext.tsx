import React, { createContext, useCallback, useContext, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createWorkspaceForUser, updateWorkspaceSettings as persistWorkspaceSettings, rowToWorkspace } from '../services/workspaceService';
import type { Workspace, WorkspaceSettings } from '../types/workspace';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  user: User | null;
  workspace: Workspace | null;
  settings: WorkspaceSettings | null;
  
  // Setters for Orchestrator
  setWorkspace: (ws: Workspace | null) => void;
  refreshWorkspace: (workspaceId: string) => Promise<void>;
  
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

export interface CreateWorkspaceInput {
  name: string;
  settings: WorkspaceSettings;
  templateId?: string;
  executionMode?: string;
  defaultLanes?: number;
  workflowRules?: Record<string, any>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const refreshWorkspace = useCallback(async (workspaceId: string) => {
    if (!isSupabaseConfigured || !workspaceId) {
      setWorkspace(null);
      return;
    }

    try {
      const { data: workspaceRow, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (workspaceError) throw workspaceError;
      if (workspaceRow) {
        setWorkspace(rowToWorkspace(workspaceRow as any));
      } else {
        setWorkspace(null);
      }
    } catch (err: any) {
      console.error('WorkspaceContext: refreshWorkspace failed:', err);
      setWorkspace(null);
    }
  }, []);

  const createWorkspace = useCallback(async ({ name, settings, templateId, executionMode, defaultLanes, workflowRules }: CreateWorkspaceInput) => {
    if (!profile) throw new Error('You must be signed in to create a workspace.');
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

    const nextWorkspace = await createWorkspaceForUser({ name, settings, user: profile as any, templateId, executionMode, defaultLanes, workflowRules });
    setWorkspace(nextWorkspace);
    return nextWorkspace;
  }, [profile]);

  const updateWorkspaceSettings = useCallback(async (updates: Partial<WorkspaceSettings>) => {
    if (!workspace || !isSupabaseConfigured) return;

    const newSettings = { ...workspace.settings, ...updates };
    await persistWorkspaceSettings(workspace.id, newSettings);
    
    setWorkspace(prev => prev ? { ...prev, settings: newSettings } : null);
  }, [workspace]);

  const signOut = useCallback(async () => {
    // Rely on AuthContext to trigger logout, which drives state machine
    window.dispatchEvent(new CustomEvent('resolve-session-expiry', { detail: { reason: 'signed_out' } }));
  }, []);

  const t = useCallback((key: string, fallback?: string) => {
    const keys = key.split('.');
    let result: any = workspace?.settings?.terminology;
    for (const k of keys) {
      if (result && typeof result === 'object') {
        result = result[k];
      } else {
        return fallback || key;
      }
    }
    return (result as string) || fallback || key;
  }, [workspace?.settings?.terminology]);

  return (
    <WorkspaceContext.Provider value={{
      user: profile as any,
      workspace,
      settings: workspace?.settings || null,
      setWorkspace,
      refreshWorkspace,
      createWorkspace,
      updateWorkspaceSettings,
      signOut,
      t
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
