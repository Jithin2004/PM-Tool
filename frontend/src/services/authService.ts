import { supabase } from '../lib/supabase';

export async function loginWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({
        email,
        password
    });
}

export async function createAuthAccount(email: string, password: string, metadata?: { full_name?: string; avatar_url?: string; }) {
    return supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata ?? {}
        }
    });
}

export async function logoutUser() {
    return supabase.auth.signOut();
}

export async function sendPasswordReset(email: string) {
    return supabase.auth.resetPasswordForEmail(email);
}

export async function updatePassword(newPassword: string) {
    return supabase.auth.updateUser({
        password: newPassword
    });
}