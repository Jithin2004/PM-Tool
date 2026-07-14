import { supabase } from '../lib/supabase';
import { enterpriseEventPublisher } from './enterpriseEventPublisher';

export async function loginWithPassword(email: string, password: string) {
    const result = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (result.error) {
        let workspaceId = '00000000-0000-0000-0000-000000000000';
        try {
            const { data: user } = await supabase.from('users').select('workspace_id').eq('email', email).maybeSingle();
            if (user?.workspace_id) workspaceId = user.workspace_id;
        } catch {}
        
        await enterpriseEventPublisher.publish({
          workspace_id: workspaceId,
          entity_type: 'user',
          verb: 'failed_login',
          title: 'Failed Login Attempt',
          description: `Failed login attempt for ${email}: ${result.error.message}`,
          severity: 'high',
          importance: 'important',
          icon_key: 'warning',
          visibility: 'admin',
          module: 'authentication',
          metadata: { email, error: result.error.message }
        });
    } else if (result.data.user) {
        let workspaceId = '00000000-0000-0000-0000-000000000000';
        let actorName = email.split('@')[0];
        let actorAvatar = undefined;
        try {
            const { data: user } = await supabase.from('users').select('workspace_id, full_name, avatar_url').eq('id', result.data.user.id).maybeSingle();
            if (user?.workspace_id) workspaceId = user.workspace_id;
            if (user?.full_name) actorName = user.full_name;
            if (user?.avatar_url) actorAvatar = user.avatar_url;
        } catch {}

        await enterpriseEventPublisher.publish({
          workspace_id: workspaceId,
          user_id: result.data.user.id,
          actor_name: actorName,
          actor_avatar: actorAvatar,
          entity_type: 'user',
          entity_id: result.data.user.id,
          verb: 'login',
          title: 'User Logged In',
          description: `${actorName} successfully logged in.`,
          severity: 'low',
          importance: 'info',
          icon_key: 'login',
          visibility: 'public',
          module: 'authentication'
        });
    }
    return result;
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
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            let workspaceId = '00000000-0000-0000-0000-000000000000';
            let actorName = session.user.email?.split('@')[0] || 'User';
            let actorAvatar = undefined;
            const { data: user } = await supabase.from('users').select('workspace_id, full_name, avatar_url').eq('id', session.user.id).maybeSingle();
            if (user?.workspace_id) workspaceId = user.workspace_id;
            if (user?.full_name) actorName = user.full_name;
            if (user?.avatar_url) actorAvatar = user.avatar_url;

            await enterpriseEventPublisher.publish({
              workspace_id: workspaceId,
              user_id: session.user.id,
              actor_name: actorName,
              actor_avatar: actorAvatar,
              entity_type: 'user',
              entity_id: session.user.id,
              verb: 'logout',
              title: 'User Logged Out',
              description: `${actorName} successfully logged out.`,
              severity: 'low',
              importance: 'info',
              icon_key: 'logout',
              visibility: 'public',
              module: 'authentication'
            });
        }
    } catch (e) {
        console.error('Failed to log logout event:', e);
    }
    return supabase.auth.signOut();
}

export async function sendPasswordReset(email: string) {
    const result = await supabase.auth.resetPasswordForEmail(email);
    let workspaceId = '00000000-0000-0000-0000-000000000000';
    try {
        const { data: user } = await supabase.from('users').select('workspace_id').eq('email', email).maybeSingle();
        if (user?.workspace_id) workspaceId = user.workspace_id;
    } catch {}

    await enterpriseEventPublisher.publish({
      workspace_id: workspaceId,
      entity_type: 'user',
      verb: 'password_reset',
      title: 'Password Reset Requested',
      description: `Password reset link requested for ${email}.`,
      severity: 'medium',
      importance: 'normal',
      icon_key: 'warning',
      visibility: 'admin',
      module: 'authentication',
      metadata: { email, success: !result.error }
    });
    return result;
}

export async function updatePassword(newPassword: string) {
    return supabase.auth.updateUser({
        password: newPassword
    });
}