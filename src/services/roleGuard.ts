import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export type RoleLevel = 'viewer' | 'dev' | 'pm' | 'super_admin';

const ROLE_HIERARCHY: Record<RoleLevel, number> = {
  viewer: 0,
  dev: 1,
  pm: 2,
  super_admin: 3,
};

export function meetsRole(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function requireRole(
  workspaceId: string, userId: string, requiredRole: RoleLevel, action: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('workspace_id', workspaceId)
      .single();
    if (!data) return false;
    const userRole = data.role as RoleLevel;
    if (!meetsRole(userRole, requiredRole)) {
      await activityLogService.logRoleGuardRejected(workspaceId, action, userId, requiredRole);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function requireWorkspaceAccess(
  workspaceId: string, userId: string, action: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('workspace_id', workspaceId)
      .single();
    if (!data) {
      await activityLogService.logRoleGuardRejected(workspaceId, action, userId, 'workspace_access');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function requireAdmin(
  workspaceId: string, userId: string, action: string
): Promise<boolean> {
  return requireRole(workspaceId, userId, 'super_admin', action);
}
