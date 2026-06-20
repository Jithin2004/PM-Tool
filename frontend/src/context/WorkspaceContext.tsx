import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createWorkspaceForUser, getWorkspaceForUser, updateWorkspaceSettings as persistWorkspaceSettings, rowToWorkspace } from '../services/workspaceService';
import type { Workspace, WorkspaceSettings } from '../types/workspace';
import { useAuth } from './AuthContext';
import { hasCapability } from '../core/auth/permissions';
//import { buildOAuthRedirectUrl, setRedirectToAfterAuth } from '../core/auth/postAuthRedirect';
import { companyCalendarService } from '../services/companyCalendarService';
import { workspaceMemberCache } from '../core/engines/workspaceMemberCache';

interface WorkspaceContextValue {
  user: User | null;
  workspace: Workspace | null;
  settings: WorkspaceSettings | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { profile, loading: authLoading } = useAuth();

  const refreshWorkspace = useCallback(async () => {
    if (import.meta.env.DEV) {
    }
    if (!isSupabaseConfigured || !profile?.workspace_id) {
      setWorkspace(null);
      return;
    }

    try {
      const { data: workspaceRow, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', profile.workspace_id)
        .maybeSingle();

      if (workspaceError) throw workspaceError;
      if (workspaceRow) {
        setWorkspace(rowToWorkspace(workspaceRow as any));
      } else {
        setWorkspace(null);
      }
    } catch (err: any) {
      console.error('WorkspaceContext: refreshWorkspace failed:', err);
      setError(err?.message || 'Workspace lookup failed.');
      setWorkspace(null);
    }
  }, [profile?.workspace_id]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isSupabaseConfigured) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    if (!profile) {
      setUser(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }

    // Align active user with profile identity
    setUser(profile as any);

    if (!profile.workspace_id) {
      setWorkspace(null);
      setLoading(false);
      workspaceMemberCache.destroy();
      return;
    }

    setLoading(true);
    let active = true;

    const loadWorkspace = async () => {
      try {
        const { data: workspaceRow, error: workspaceError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', profile.workspace_id)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (workspaceError) throw workspaceError;
        if (workspaceRow) {
          const parsed = rowToWorkspace(workspaceRow as any);
          setWorkspace(prev => {
            if (prev && prev.id !== workspaceRow.id) {
              supabase.removeAllChannels();
            }
            return parsed;
          });

          // Initialize workspace member cache
          workspaceMemberCache.hydrate(parsed.id);
          workspaceMemberCache.initializeRealtimeSync(parsed.id);

          // Auto-fetch next year's holidays in background (owner / super_admin only)
          if (parsed.settings?.country && profile && (profile.id === parsed.ownerId || hasCapability(profile.role, 'manage_settings'))) {
            companyCalendarService.syncHolidays(parsed.id, parsed.settings.country, parsed.settings.region || '').catch(() => { });
          } else if (parsed.settings?.country) {
          }

          // Wave 8: Trigger Audit Integrity Verification
          import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
            ObservabilityEngine.verifyAuditLedger(supabase, parsed.id);
          });
        } else {
          setWorkspace(null);
        }
      } catch (err: any) {
        console.error("WorkspaceContext load workspace error:", err);
        if (active) {
          setWorkspace(null);
          setError(err?.message || 'Workspace lookup failed.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadWorkspace();

      // Bulletproof fallback to prevent infinite loading screens
      // 10 seconds is reasonable for Render with reliable connectivity
      const safetyTimeout = setTimeout(() => {
        if (active) {
          setLoading(false);
        }
      }, 10000);

    return () => {
      active = false;
      clearTimeout(safetyTimeout);
    };
  }, [profile, authLoading, isSupabaseConfigured]);

  const createWorkspace = useCallback(async ({ name, settings, templateId, executionMode, defaultLanes, workflowRules }: CreateWorkspaceInput) => {
    if (!user) throw new Error('You must be signed in to create a workspace.');
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

    setError(null);

    try {
      const nextWorkspace = await createWorkspaceForUser({ name, settings, user, templateId, executionMode, defaultLanes, workflowRules });
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
      setWorkspace(await persistWorkspaceSettings(workspace, settings, profile?.id));
    } catch (err: any) {
      setError(err?.message || 'Workspace update failed.');
      throw err;
    }
  }, [workspace, profile?.id]);


  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setWorkspace(null);
    workspaceMemberCache.destroy();
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const termMap = (workspace?.settings as any)?.terminology || {};
    return termMap[key] || fallback || key;
  }, [workspace?.settings]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    user,
    workspace,
    settings: workspace?.settings || null,
    loading,
    error,
    refreshWorkspace,
    createWorkspace,
    updateWorkspaceSettings,
    signOut,
    t
  }), [user, workspace, loading, error, refreshWorkspace, createWorkspace, updateWorkspaceSettings, signOut, t]);

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
