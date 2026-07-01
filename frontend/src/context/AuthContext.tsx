import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';
import { clearSession, flushNow } from '../services/commandUsageService';
import { activityLogService } from '../services/activityLogService';
import { hasCapability } from '../core/auth/permissions';
import { clearLicense } from '../lib/productKey';
import { AuthState } from '../core/lifecycle/types';

interface AuthContextType {
  user: any | null;
  profile: User | null;
  authState: AuthState;
  
  // Setters for the BootstrapOrchestrator to feed data back in
  setProfile: (p: User | null) => void;
  setUser: (u: any | null) => void;
  setAuthState: (state: AuthState) => void;

  logout: () => Promise<void>;
  updateRole: (id: string, role: User['role']) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  
  simulatedRole: User['role'] | null;
  setSimulatedRole: (role: User['role'] | null) => void;
  isSimulating: boolean;
  trueProfile: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>(AuthState.BOOTING);
  const [simulatedRole, setSimulatedRole] = useState<User['role'] | null>(null);

  const effectiveProfile = React.useMemo(() => {
    if (!profile) return null;
    if (simulatedRole) return { ...profile, role: simulatedRole };
    return profile;
  }, [profile, simulatedRole]);

  const userRef = useRef(user);
  const profileRef = useRef(profile);
  const sessionExpiryInProgressRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const handleSessionExpiry = useCallback(async (reason: string) => {
    if (sessionExpiryInProgressRef.current) return;
    sessionExpiryInProgressRef.current = true;

    try {
      if (userRef.current) {
        try {
          const p = profileRef.current;
          const ws = p?.workspace_id;
          if (ws) {
            await activityLogService.logSessionExpired(ws, userRef.current.id, reason);
          }
        } catch { }
      }
      await flushNow();
      clearSession();

      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('tasks_') ||
            key.startsWith('projects_') ||
            key.startsWith('offline_task_queue_') ||
            key.startsWith('task_dependencies_') ||
            key.startsWith('id_map_') ||
            key.startsWith('workspace_settings_') ||
            key.startsWith('resolve-command-') ||
            key.startsWith('SYSTEM_SETTINGS_') ||
            key === 'SYSTEM_SETTINGS' ||
            key === 'resolve-session-id' ||
            key === 'resolve-log-forensics'
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }

      clearLicense();

      setUser(null);
      setProfile(null);
      setAuthState(AuthState.UNAUTHENTICATED);
      supabase.removeAllChannels();

      if (window.location.pathname === '/login') {
        return;
      }

      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: `Session ${reason}.`, type: 'error' },
      }));
    } finally {
      sessionExpiryInProgressRef.current = false;
    }
  }, []);

  const logout = async () => {
    await handleSessionExpiry('expired');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const updateRole = async (id: string, role: User['role']) => {
    if (!hasCapability(profile?.role, 'workspace.update') || !isSupabaseConfigured) return false;

    const { mapAuthorityToLegacyRole } = await import('../core/types/workspace');
    const dbRole = mapAuthorityToLegacyRole(role);

    const { error } = await supabase
      .from('users')
      .update({ role: dbRole })
      .eq('id', id);

    if (!error) {
      if (profile?.id === id) {
        setProfile(prev => prev ? { ...prev, role } : null);
      }
      return true;
    }
    return false;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!profile?.id || !isSupabaseConfigured) return false;

    const FORBIDDEN_PROFILE_FIELDS = new Set([
      'role', 'workspace_id', 'id', 'created_at',
    ]);
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!FORBIDDEN_PROFILE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) return false;

    const { error } = await supabase
      .from('users')
      .update(sanitized)
      .eq('id', profile.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...sanitized } : null);
      return true;
    }
    return false;
  };

  // We expose handleSessionExpiry so Orchestrator can trigger it if needed
  useEffect(() => {
    window.addEventListener('resolve-session-expiry', (e: any) => {
      handleSessionExpiry(e.detail?.reason || 'expired');
    });
    return () => {
      window.removeEventListener('resolve-session-expiry', () => {});
    };
  }, [handleSessionExpiry]);

  return (
    <AuthContext.Provider value={{
      user,
      profile: effectiveProfile,
      authState,
      setProfile,
      setUser,
      setAuthState,
      logout,
      updateRole,
      updateProfile,
      simulatedRole,
      setSimulatedRole,
      isSimulating: !!simulatedRole,
      trueProfile: profile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
