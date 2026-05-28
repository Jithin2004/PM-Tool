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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileHydrating, setProfileHydrating] = useState(false);

  // Refs to prevent stale closures in event listeners
  const loadingRef = React.useRef(loading);
  const userRef = React.useRef(user);
  const profileRef = React.useRef(profile);
  const lastSyncedUserIdRef = React.useRef<string | null>(null);
  const syncPromiseRef = React.useRef<Promise<Member | null> | null>(null);
  const syncUserRef = React.useRef<string | null>(null);
  const safetyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
        console.log("AuthContext: syncProfile() already completed for:", authUser.id);
      }
      return;
    }

    // If a sync for the same user is currently in progress, return the existing promise
    if (!force && syncUserRef.current === authUser.id && syncPromiseRef.current) {
      if (import.meta.env.DEV) {
        console.log("AuthContext: syncProfile() already in progress for:", authUser.id);
      }
      return syncPromiseRef.current;
    }

    syncUserRef.current = authUser.id;

    const promise = (async () => {
      console.log("[AuthContext syncProfile START]: user email:", authUser.email, "id:", authUser.id);

      try {
        const googleAvatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
        const email = authUser.email;
        const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';

        console.log("[AuthContext syncProfile querying users table...]");
        // 1. Primary Query: Canonical users table
        let { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        console.log("[AuthContext syncProfile query complete]: error:", error, "data:", data);
        if (error && error.code !== 'PGRST116') {
          console.error("Error fetching from users table:", error);
        }

        if (!data) {
          setProfileHydrating(true);
          const delays = [250, 500, 1000, 2000];
          for (let i = 0; i < delays.length; i++) {
            await new Promise(r => setTimeout(r, delays[i]));
            console.log(`[AuthContext] hydrating profile retry ${i + 1}/${delays.length}`);
            const retry = await supabase
              .from('users')
              .select('*')
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
            avatarUrl: googleAvatar,
          });

          if (import.meta.env.DEV) {
            console.log('[AuthContext] reconcileInvitationMembership:', reconciliation.outcome);
          }

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

        if (data && !data.avatar_url && googleAvatar) {
          const { data: updatedUser } = await supabase
            .from('users')
            .update({ avatar_url: googleAvatar })
            .eq('id', authUser.id)
            .select()
            .maybeSingle();
          if (updatedUser) data = updatedUser;
        }

        if (data) {
          const profileWithDesignation = rowToProfile(data as Record<string, unknown>);
          console.log("[AuthContext syncProfile success]: profile set with designation:", profileWithDesignation.designation);
          setProfile(profileWithDesignation);
          lastSyncedUserIdRef.current = authUser.id;
          setProfileResolved(true);
          return profileWithDesignation;
        } else {
          console.warn("[AuthContext syncProfile]: no user data returned, setting profile to null");
          setProfile(null);
          setProfileResolved(true);
          return null;
        }
      } catch (err) {
        console.error("[AuthContext syncProfile CRITICAL ERROR]:", err);
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
    console.log("[validateUserWorkspace START]:", { userId: authUser?.id, email: authUser?.email, currentProfile });
    if (!isSupabaseConfigured || !currentProfile) {
      console.log("[validateUserWorkspace SKIP]: not configured or no profile");
      return;
    }
    if (currentProfile.workspace_id) {
      console.log("[validateUserWorkspace SUCCESS]: user already has workspace_id:", currentProfile.workspace_id);
      setNeedsWorkspaceSetup(false);
      return;
    }

    console.log("[validateUserWorkspace] calling repairUserWorkspace...");
    const result = await repairUserWorkspace(authUser.id, authUser.email);
    console.log("[validateUserWorkspace] repairUserWorkspace result:", result);

    if (result.repaired && result.workspaceId) {
      console.log("[validateUserWorkspace] successfully repaired workspace!");
      await activityLogService.logWorkspaceRepaired(result.workspaceId, authUser.id, result.reason);
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
      if (data) {
        setProfile(rowToProfile(data as Record<string, unknown>));
      }
      setNeedsWorkspaceSetup(false);
    } else if (result.reason === 'orphaned') {
      console.warn("[validateUserWorkspace] user is ORPHANED. Redirecting to /login?error=uninvited");
      await activityLogService.logWorkspaceOrphanDetected(authUser.id, authUser.email);
      setNeedsWorkspaceSetup(false);
      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: 'Account has no workspace access. Contact your admin.', type: 'error' },
      }));
      navigateTo('/login?error=uninvited', true);
    } else {
      console.log("[validateUserWorkspace] needs_workspace_setup. Allowing access to setup page.");
      setNeedsWorkspaceSetup(true);
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
        console.log("[AuthContext initAuth START]");
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        console.log("[AuthContext initAuth getSession resolved]: session:", session ? "FOUND" : "NULL", "user:", session?.user?.email);
        setUser(session?.user || null);
        if (session?.user) {
          const syncedProfile = await syncProfile(session.user);
          // After syncProfile completes, validate workspace context
          if (syncedProfile) {
            await validateUserWorkspace(session.user, syncedProfile);
          }
          console.log("[AuthContext] resolved: authenticated");
        } else {
          setProfile(null);
          setProfileResolved(true);
          console.log("[AuthContext] resolved: anonymous");
        }
      } catch (err) {
        console.error("[AuthContext initAuth CRITICAL ERROR]:", err);
        setProfile(null);
        setProfileResolved(true);
        console.log("[AuthContext] resolved: anonymous (error fallback)");
      } finally {
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        console.log("[AuthContext initAuth FINISHED] setting loading to false");
        setLoading(false);
      }
    };

    // Explicitly initialize auth state
    initAuth();

    // Bulletproof fallback to absolutely prevent infinite loading screens
    // Extended to 15s to support cold starts and network delays on reload.
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      if (safetyTimeoutRef.current) {
        console.warn("[AuthContext safetyTimeout triggered!] forcing loading to false");
        setLoading(false);
        safetyTimeoutRef.current = null;
      }
    }, 15000);

    console.log("[AuthContext subscribing to onAuthStateChange]");
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthContext onAuthStateChange TRIGGERED]: event:", event, "session user:", session?.user?.email);
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Ignore initial dummy events during loading/initialization
        if (loadingRef.current) {
          console.log("[AuthContext onAuthStateChange]: ignoring SIGNED_OUT during initial load");
          return;
        }

        handleSessionExpiry(event === 'SIGNED_OUT' ? 'expired' : 'refresh_failed').catch(() => {});
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

    return () => {
      mounted = false;
      if (authListener) authListener.unsubscribe();
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [syncProfile]);

  const handleSessionExpiry = useCallback(async (reason: string) => {
    if (userRef.current) {
      try {
        const p = profileRef.current;
        const ws = p?.workspace_id;
        if (ws) {
          await activityLogService.logSessionExpired(ws, userRef.current.id, reason);
        }
      } catch {}
    }
    await flushNow();
    clearSession();
    setUser(null);
    setProfile(null);
    supabase.removeAllChannels();
    captureRedirectFromLocation();
    if (window.location.pathname === '/login') {
      return; // Do not show session expired toast or redirect if intentionally signed out on the login page
    }

    window.dispatchEvent(new CustomEvent('notify-toast', {
      detail: { message: `Session ${reason}. Redirecting...`, type: 'error' },
    }));
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      navigateTo('/', true);
    }
  }, []);

  const logout = async () => {
    await handleSessionExpiry('expired');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  const updateRole = async (id: string, role: User['role']) => {
    if (!hasCapability(profile?.role, 'platform_governance') || !isSupabaseConfigured) return false;

    const { error } = await supabase
      .from('users')
      .update({ role })
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

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', profile.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return true;
    }
    return false;
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await syncProfile(user, true);
    }
  }, [user, syncProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileResolved, profileHydrating, needsWorkspaceSetup, logout, updateRole, updateProfile, refreshProfile }}>
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
