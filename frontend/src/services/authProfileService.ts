import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';
import { reconcileInvitationMembership, rowToProfile } from '../core/auth/reconcileInvitationMembership';
import { enterpriseEventPublisher } from './enterpriseEventPublisher';


export async function syncProfile(authUser: any): Promise<User | null> {
  if (!isSupabaseConfigured) return null;

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
      // Optimized retry logic
      const maxRetries = 2;
      const delays = [100, 300];
      
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
    }

    if (!data) {
      const reconciliation = await reconcileInvitationMembership({
        authUserId: authUser.id,
        email: email || '',
        fullName,
        avatarUrl: providerAvatar,
      });

      if (reconciliation.outcome === 'uninvited' && reconciliation.uninvitedProfile) {
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

      return rowToProfile(extendedData as Record<string, unknown>);
    } else {
      return null;
    }
  } catch (err) {
    console.error("Error in syncProfile:", err);
    return null;
  }
}

export async function updateRole(id: string, role: User['role'], currentProfile: User | null): Promise<boolean> {
  if (!currentProfile || !isSupabaseConfigured) return false;
  
  // Need to import hasCapability dynamically or pass it to avoid cyclic deps, 
  // but let's just do a basic admin check for now or use the helper
  const { hasCapability } = await import('../core/auth/permissions');
  if (!hasCapability(currentProfile.role, 'workspace.update')) return false;

  const { mapAuthorityToLegacyRole } = await import('../core/types/workspace');
  const dbRole = mapAuthorityToLegacyRole(role);

  const { error } = await supabase
    .from('users')
    .update({ role: dbRole })
    .eq('id', id);

  if (!error) {
    try {
      await enterpriseEventPublisher.publish({
        workspace_id: currentProfile.workspace_id || '00000000-0000-0000-0000-000000000000',
        user_id: currentProfile.id,
        entity_type: 'user',
        entity_id: id,
        verb: 'role_changed',
        title: 'Role Updated',
        description: `Role of user ${id} updated to ${role}.`,
        severity: 'medium',
        importance: 'important',
        icon_key: 'warning',
        visibility: 'admin',
        module: 'administration',
        metadata: { updated_user_id: id, new_role: role }
      });
    } catch (e) {
      console.error('Failed to log role_changed event:', e);
    }
  }

  return !error;
}

export async function updateProfile(updates: Partial<User>, currentProfileId: string | undefined): Promise<boolean> {
  if (!currentProfileId || !isSupabaseConfigured) return false;

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
    .eq('id', currentProfileId);

  return !error;
}
