import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: any | null; // Supabase auth user
  profile: User | null; // Canonical profile
  loading: boolean;
  logout: () => Promise<void>;
  updateRole: (id: string, role: User['role']) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = useCallback(async (authUser: any) => {
    if (!isSupabaseConfigured) return;
    if (import.meta.env.DEV) {
      console.log("AuthContext: syncProfile() started for user:", authUser.id);
    }

    try {
      const googleAvatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;
      const email = authUser.email;
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email?.split('@')[0] || 'User';

      if (import.meta.env.DEV) {
        console.log("AuthContext: syncProfile() querying users table...");
      }
      // 1. Primary Query: Canonical users table
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (import.meta.env.DEV) {
        console.log("AuthContext: syncProfile() users query completed. error:", error, "data:", data);
      }
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching from users table:", error);
      }

      if (!data) {
        // 2. First-User Assignment & Brand New User Onboarding Flow
        if (import.meta.env.DEV) {
          console.log("New user detected in AuthContext. Determining first-user role assignment...");
        }
        const { count: usersCount, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error("Error fetching users count:", countError);
        }

        const newRole = usersCount === 0 ? 'super_admin' : 'viewer';

        data = {
          id: authUser.id,
          workspace_id: 'pending-workspace-setup',
          email: authUser.email,
          full_name: fullName,
          avatar_url: googleAvatar,
          role: newRole,
          availability_factor: 1,
          created_at: new Date().toISOString()
        };
      } else {
        // We found canonical user in users table. Update avatar if missing.
        if (!data.avatar_url && googleAvatar) {
          const { data: updatedUser } = await supabase
            .from('users')
            .update({ avatar_url: googleAvatar })
            .eq('id', authUser.id)
            .select()
            .maybeSingle();
          if (updatedUser) data = updatedUser;
        }
      }

      // Ensure designation field is attached if needed by any consuming components
      if (data) {
        const profileWithDesignation = {
          ...data,
          auth_user_id: data.id,
          designation: data.role === 'super_admin' ? 'Super Admin' : data.role === 'pm' ? 'Project Manager' : 'Developer'
        };
        setProfile(profileWithDesignation as User);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Identity sync failed:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    if (import.meta.env.DEV) {
      console.log("AuthContext: subscribing to onAuthStateChange...");
    }
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (import.meta.env.DEV) {
        console.log("AuthContext: onAuthStateChange event:", event, "session user:", session?.user?.id || 'none');
      }
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setLoading(true);
        setUser(null);
        setProfile(null);
        supabase.removeAllChannels();
        setLoading(false);
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Session expired. Redirecting...", type: "error" } }));
        setTimeout(() => { window.location.href = '/'; }, 1000);
        return;
      }

      setLoading(true);
      setUser(session?.user || null);
      if (session?.user) {
        await syncProfile(session.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    const authListener = data.subscription;

    const fallbackTimeout = setTimeout(async () => {
      if (mounted && loading) {
        if (import.meta.env.DEV) {
          console.log("AuthContext: fallback session check triggered");
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && loading) {
          setUser(session?.user || null);
          if (session?.user) {
            await syncProfile(session.user);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }
      }
    }, 150);

    return () => {
      mounted = false;
      if (authListener) authListener.unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, [syncProfile]);

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const updateRole = async (id: string, role: User['role']) => {
    if (profile?.role !== 'super_admin' || !isSupabaseConfigured) return false;

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

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, updateRole, updateProfile }}>
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
