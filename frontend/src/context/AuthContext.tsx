import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Member } from '../types';
import { clearSession, flushNow } from '../services/commandUsageService';
import { activityLogService } from '../services/activityLogService';
import { repairUserWorkspace } from '../services/workspaceService';
import { hasCapability } from '../core/auth/permissions';
import {
  reconcileInvitationMembership,
  rowToProfile,
} from '../core/auth/reconcileInvitationMembership';
import {
  captureRedirectFromLocation,
  navigateTo,
} from '../core/auth/postAuthRedirect';
import { clearLicense, isProductKeyVerified, checkLicenseOnline } from '../lib/productKey';

interface AuthContextType {
  user: any | null;
  profile: User | null;
  loading: boolean;
  profileResolved: boolean;
  profileHydrating: boolean;
  needsWorkspaceSetup: boolean;
  logout: () => Promise<void>;
  updateRole: (id: string, role: User['role']) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  simulatedRole: User['role'] | null;
  setSimulatedRole: (role: User['role'] | null) => void;
  isSimulating: boolean;
  trueProfile: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileHydrating, setProfileHydrating] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<User['role'] | null>(null);

  const effectiveProfile = React.useMemo(() => {
    if (!profile) return null;
    if (simulatedRole) return { ...profile, role: simulatedRole };
    return profile;
  }, [profile, simulatedRole]);

  // Refs to prevent stale closures in event listeners
  const loadingRef = React.useRef(loading);
  const userRef = React.useRef(user);
  const profileRef = React.useRef(profile);
  const lastSyncedUserIdRef = React.useRef<string | null>(null);
  const syncPromiseRef = React.useRef<Promise<Member | null> | null>(null);
  const syncUserRef = React.useRef<string | null>(null);
  const safetyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionExpiryInProgressRef = React.useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (profileResolved && safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, [profileResolved]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const syncProfile = useCallback(async (authUser: any, force = false) => {
    if (!isSupabaseConfigured) return;

    // If we already synced this user and it's not a forced refresh, skip
    if (!force && lastSyncedUserIdRef.current === authUser.id) {
      if (import.meta.env.DEV) {
      }
      return profileRef.current;
    }

    // If a sync for the same user is currently in progress, return the existing promise
    if (!force && syncUserRef.current === authUser.id && syncPromiseRef.current) {
      if (import.meta.env.DEV) {
      }
      return syncPromiseRef.current;
    }

    syncUserRef.current = authUser.id;

    const promise = (async () => {
      try {
        const providerAvatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
        const email = authUser.email;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';

        // 1. Primary Query: Canonical users table
        let { data, error } = await supabase
          .from('users')
          .select('*, workspaces!users_workspace_id_fkey(created_by_id)')
          .eq('id', authUser.id)
          .maybeSingle();

if (error && error.code !== 'PGRST116') {
          console.error("Error fetching from users table:", error);
        }

        if (!data) {
setProfileHydrating(true);
          // Optimized retry logic: fewer delays for Render's reliable database
          // In production, first query usually succeeds; retries are for eventual consistency edge cases
          const maxRetries = 2; // Reduced from 4
          const delays = [100, 300]; // Reduced from [250, 500, 1000, 2000]
          
          for (let i = 0; i < maxRetries; i++) {
            await new Promise(r => setTimeout(r, delays[i]));
            const retry = await supabase
              .from('users')
              .select('*, workspaces!users_workspace_id_fkey(created_by_id)')
              .eq('id', authUser.id)
              .maybeSingle();
            if (retry.data) {
              data = retry.data;
              error = null;
              break;
            }
            if (retry.error && retry.error.code !== 'PGRST116') {
              error = retry.error;
              break;
            }
          }
setProfileHydrating(false);
        }

        if (!data) {
          const reconciliation = await reconcileInvitationMembership({
            authUserId: authUser.id,
            email: email || '',
            fullName,
            avatarUrl: providerAvatar,
          });

          if (reconciliation.outcome === 'uninvited' && reconciliation.uninvitedProfile) {
            setProfile(reconciliation.uninvitedProfile);
            setProfileResolved(true);
            setLoading(false);
            return reconciliation.uninvitedProfile;
          }

          if (reconciliation.userRow) {
            data = reconciliation.userRow;
          }
        }

if (data && !data.avatar_url && providerAvatar) {
          const { data: updatedUser } = await supabase
            .from('users')
            .update({ avatar_url: providerAvatar })
            .eq('id', authUser.id)
            .select()
            .maybeSingle();
          if (updatedUser) data = updatedUser;
        }

        if (data) {
// Task 3: Fetch database capabilities
          const { data: roleCaps } = await supabase
            .from('role_capabilities')
            .select('capability_id')
            .eq('role_id', data.role);
            
          const { data: userCaps } = await supabase
            .from('user_capability_overrides')
            .select('capability_id')
            .eq('user_id', data.id);

          const dbCapabilities = [
            ...(roleCaps?.map(r => r.capability_id) || []),
            ...(userCaps?.map(u => u.capability_id) || [])
          ];

          const is_owner = data.workspaces ? (Array.isArray(data.workspaces) ? data.workspaces[0]?.created_by_id === data.id : data.workspaces.created_by_id === data.id) : false;

          const extendedData = {
            ...data,
            is_owner,
            functionalAccess: data.capabilities,
            capabilities: dbCapabilities.length > 0 ? Array.from(new Set(dbCapabilities)) : undefined
          };

const profileWithDesignation = rowToProfile(extendedData as Record<string, unknown>);
          setProfile(profileWithDesignation);
          lastSyncedUserIdRef.current = authUser.id;
          setProfileResolved(true);
          return profileWithDesignation;
        } else {
          setProfile(null);
          setProfileResolved(true);
          return null;
        }
      } catch (err) {
        setProfileResolved(true);
        return null;
      } finally {
        if (syncUserRef.current === authUser.id) {
          syncPromiseRef.current = null;
        }
      }
    })();

    syncPromiseRef.current = promise;
    return promise;
  }, []);

  // ── Auth Integrity: validate & repair workspace context ──

  const [needsWorkspaceSetup, setNeedsWorkspaceSetup] = useState(false);

  const validateUserWorkspace = useCallback(async (authUser: any, currentProfile: User | null) => {
    if (!isSupabaseConfigured || !currentProfile) {
      return;
    }
    if (currentProfile.workspace_id) {
      setNeedsWorkspaceSetup(false);
      return;
    }
    if (currentProfile.role === 'pending-workspace-setup') {
      setNeedsWorkspaceSetup(true);
      return;
    }

    const result = await repairUserWorkspace(authUser.id, authUser.email);

    if (result.repaired && result.workspaceId) {
      await activityLogService.logWorkspaceRepaired(result.workspaceId, authUser.id, result.reason);
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
      if (data) {
        setProfile(rowToProfile(data as Record<string, unknown>));
      }
      setNeedsWorkspaceSetup(false);
    } else if (result.reason === 'orphaned') {
      await activityLogService.logWorkspaceOrphanDetected(authUser.id, authUser.email);
      setNeedsWorkspaceSetup(false);
      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: 'Account has no workspace access. Contact your admin.', type: 'error' },
      }));
      navigateTo('/login?error=uninvited', true);
    } else {
      setNeedsWorkspaceSetup(true);
    }
  }, []);

  const handleSessionExpiry = useCallback(async (reason: string) => {
    // Bug 7 fix: Guard against re-entry (logout() calls this, then signOut()
    // fires onAuthStateChange SIGNED_OUT which would call this again)
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

      // Fix 4 + Wave 7.5 P1-5: Comprehensive session purge
      // Remove ALL sensitive operational data from localStorage
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

      // Requirement 6: Logout clears product-key session state
      clearLicense();

      setUser(null);
      setProfile(null);
      supabase.removeAllChannels();

      if (window.location.pathname === '/login') {
        return; // Do not show session expired toast or redirect if intentionally signed out on the login page
      }

      // Bug 2 fix: Only capture the redirect location when NOT on /login,
      // so we don't pointlessly save /login as a post-auth redirect target.
      captureRedirectFromLocation();

      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: `Session ${reason}. Redirecting...`, type: 'error' },
      }));
      if (window.location.pathname !== '/login') {
        navigateTo('/login', true);
      }
    } finally {
      sessionExpiryInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setProfileResolved(true);
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        setUser(session?.user || null);
        if (session?.user) {
          const syncedProfile = await syncProfile(session.user);
          // After syncProfile completes, validate workspace context
          if (syncedProfile) {
            await validateUserWorkspace(session.user, syncedProfile);
          }
        } else {
          setProfile(null);
          setProfileResolved(true);
        }
      } catch (err) {
        setProfile(null);
        setProfileResolved(true);
      } finally {
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        loadingRef.current = false;
        setLoading(false);
      }
    };

    // Explicitly initialize auth state
    initAuth();

    // Bulletproof fallback to prevent infinite loading screens
    // 10 seconds is reasonable: 400ms retries + network latency + processing
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      if (safetyTimeoutRef.current) {
        setLoading(false);
        setProfileResolved(true);
        safetyTimeoutRef.current = null;
      }
    }, 10000);
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Ignore initial dummy events during loading/initialization
        if (loadingRef.current) {
          return;
        }

        handleSessionExpiry(event === 'SIGNED_OUT' ? 'expired' : 'refresh_failed').catch(() => { });
        return;
      } else {
        // Handle all other events, including INITIAL_SESSION
        // If we already have the profile, we can skip syncProfile to save a query
        if (session?.user) {
          if (userRef.current?.id !== session.user.id) {
            setUser(session.user);
            // Defer the syncProfile call to release the auth event lock and prevent deadlocks
            setTimeout(async () => {
              if (mounted) {
                const syncedProfile = await syncProfile(session.user);
                if (syncedProfile) {
                  await validateUserWorkspace(session.user, syncedProfile);
                }
              }
            }, 0);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    });
    const authListener = data.subscription;

    // Real-time listener for profile/role updates
    let userSubscription: any = null;

    // We set up the real-time listener inside a wrapper to handle dynamic user changes
    const setupRealtimeUser = (userId: string) => {
      if (userSubscription) supabase.removeChannel(userSubscription);

      userSubscription = supabase.channel(`public:users:id=eq.${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        }, async (payload) => {
          if (mounted && payload.new) {
            const updatedProfile = await syncProfile({ id: userId, email: payload.new.email } as any);
            if (updatedProfile) {
              // Check if they lost workspace access
              if (!updatedProfile.workspace_id && profileRef.current?.workspace_id) {
                handleSessionExpiry('workspace_revoked').catch(() => { });
              }
            }
          }
        })
        .subscribe();
    };

    // Set up the listener if we already have a user from initial load
    setTimeout(() => {
      if (userRef.current) {
        setupRealtimeUser(userRef.current.id);
      }
    }, 1000);

    return () => {
      mounted = false;
      if (authListener) authListener.unsubscribe();
      if (userSubscription) supabase.removeChannel(userSubscription);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [syncProfile, handleSessionExpiry]);

  // Periodic background license verification
  useEffect(() => {
    // Only verify license after the profile state is fully resolved
    if (!user || !profileResolved) return;

    const verifyLicense = async () => {
      // 1. If the user is fully onboarded and active, skip product key check (they have a workspace_id)
      if (profileRef.current?.workspace_id) return;

      // 2. Detect onboarding state: Do not evaluate database licenses before a workspace exists
      let pendingActivationValid = false;
      try {
        const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
        if (pendingStr) {
          const parsed = JSON.parse(pendingStr);
          if (parsed.validated) {
            pendingActivationValid = true;
          }
        }
      } catch (e) {}

      const isActivelyOnboarding = 
        profileRef.current?.role === 'pending-workspace-setup' || 
        pendingActivationValid;

      if (isActivelyOnboarding) {
        return; // Valid temporary state, allow setup to complete
      }

      // 3. Normal rejection flow for uninvited/unlicensed users
      if (!isProductKeyVerified()) return;

      const res = await checkLicenseOnline();
      if (!res.valid) {
        window.dispatchEvent(new CustomEvent('notify-toast', {
          detail: { message: res.error || 'License verification failed. Access revoked.', type: 'error' },
        }));
        await logout();
      }
    };

    // Initial verification check on mount
    verifyLicense();

    // Re-verify every 10 minutes
    const interval = setInterval(verifyLicense, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, profileResolved]);

  const logout = async () => {
    await handleSessionExpiry('expired');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const updateRole = async (id: string, role: User['role']) => {
    if (!hasCapability(profile?.role, 'workspace.update') || !isSupabaseConfigured) return false;

    // We must map AuthorityRole back to LegacyDBRole before persisting
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

    // Wave 7.5 P1-6: Strip security-sensitive fields before persistence.
    // Users must NOT be able to self-escalate via updateProfile().
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

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await syncProfile(user, true);
      if (p) {
        await validateUserWorkspace(user, p);
      }
    }
  }, [user, syncProfile, validateUserWorkspace]);

  return (
    <AuthContext.Provider value={{
      user,
      profile: effectiveProfile,
      loading,
      profileResolved,
      profileHydrating,
      needsWorkspaceSetup,
      logout,
      updateRole,
      updateProfile,
      refreshProfile,
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


