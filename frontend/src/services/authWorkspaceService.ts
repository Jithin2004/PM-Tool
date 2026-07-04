import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';
import { repairUserWorkspace } from './workspaceService';
import { activityLogService } from './activityLogService';

export async function validateAndRepairWorkspace(authUser: any, currentProfile: User): Promise<{ needsSetup: boolean, updatedProfile?: User }> {
  if (!isSupabaseConfigured || !currentProfile) {
    return { needsSetup: false };
  }
  
  if (currentProfile.workspace_id) {
    return { needsSetup: false };
  }
  
  // pending-workspace-setup should fall through to repairUserWorkspace to reconcile invitations

  const result = await repairUserWorkspace(authUser.id, authUser.email);

  if (result.repaired && result.workspaceId) {
    await activityLogService.logWorkspaceRepaired(result.workspaceId, authUser.id, result.reason);
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
    if (data) {
      // We need rowToProfile from reconcileInvitationMembership
      const { rowToProfile } = await import('../core/auth/reconcileInvitationMembership');
      return { needsSetup: false, updatedProfile: rowToProfile(data as Record<string, unknown>) };
    }
    return { needsSetup: false };
  } else if (result.reason === 'orphaned') {
    await activityLogService.logWorkspaceOrphanDetected(authUser.id, authUser.email);
    window.dispatchEvent(new CustomEvent('notify-toast', {
      detail: { message: 'Account has no workspace access. Contact your admin.', type: 'error' },
    }));
    // We rely on router to redirect based on role === 'uninvited' which this might trigger
    return { needsSetup: false };
  } else {
    return { needsSetup: true };
  }
}

export async function switchWorkspace(userId: string, targetWorkspaceId: string | null): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  
  const { error } = await supabase
    .from('users')
    .update({ workspace_id: targetWorkspaceId })
    .eq('id', userId);
    
  return !error;
}
