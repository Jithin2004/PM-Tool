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
        if (import.meta.env.DEV) {
          console.log("New user detected in AuthContext. Auto-creating users row with pending-workspace-setup...");
        }
        
        const { data: newUserRow, error: insertError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            email: email,
            workspace_id: null,
            role: 'pending-workspace-setup',
            full_name: fullName,
            avatar_url: googleAvatar,
            availability_factor: 1
          })
          .select()
          .single();

        if (insertError) {
          console.error("Failed to insert pending user row in AuthContext:", insertError);
        } else {
          data = newUserRow;
        }
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
          designation: data.role === 'super_admin' ? 'Super Admin' : data.role === 'pm' ? 'Project Manager' : data.role === 'pending-workspace-setup' ? 'Pending Setup' : 'Developer'
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

    const initAuth = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log("AuthContext: Initializing auth state...");
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        setUser(session?.user || null);
        if (session?.user) {
          await syncProfile(session.user);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("AuthContext initialization error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Explicitly initialize auth state
    initAuth();

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
      } else if (event !== 'INITIAL_SESSION') {
        // Only react to subsequent events to avoid race conditions with initAuth
        setLoading(true);
        setUser(session?.user || null);
        if (session?.user) {
          await syncProfile(session.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });
    const authListener = data.subscription;

    return () => {
      mounted = false;
      if (authListener) authListener.unsubscribe();
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
