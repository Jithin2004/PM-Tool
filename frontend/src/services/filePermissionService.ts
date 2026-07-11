import { supabase } from '../lib/supabase';
import { hasCapability } from '../core/auth/permissions';

type SensitiveScope = 'hr' | 'finance' | 'none';

/** Detect sensitive scope from entity type */
function detectScope(entityType: string): SensitiveScope {
  if (['personal_leave', 'clock_event', 'employee', 'payroll', 'attendance'].includes(entityType)) return 'hr';
  if (['invoice', 'expense', 'ledger', 'budget', 'payment'].includes(entityType)) return 'finance';
  return 'none';
}

/** Check if role has required sensitive capability */
function hasSensitiveCapability(role: string, scope: SensitiveScope): boolean {
  if (scope === 'none') return true;
  if (scope === 'hr') return hasCapability(role as any, 'people.manage');
  if (scope === 'finance') return hasCapability(role as any, 'finance.manage');
  return false;
}

export const filePermissionService = {
  /**
   * Full permission resolution chain:
   * 1. Owner / Admin  → always allowed
   * 2. Uploader       → always allowed for their own file
   * 3. Inherited from linked entity (with HR/Finance scope guard)
   * 4. Workspace member fallback for non-sensitive files
   */
  async canViewFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (hasCapability(role as any, 'document.manage')) return true;

    const { data: file } = await supabase
      .from('workspace_files')
      .select('uploaded_by, workspace_id, entity_type')
      .eq('id', fileId)
      .maybeSingle();

    if (!file) return false;

    // 2. Uploader
    if (file.uploaded_by === userId) return true;

    // 3. Inherited entity permission scope check
    const scope = detectScope(file.entity_type);
    if (scope !== 'none' && !hasSensitiveCapability(role, scope)) {
      return false;
    }

    return this._isWorkspaceMember(file.workspace_id, userId);
  },

  async canEditFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (hasCapability(role as any, 'document.manage')) return true;

    const { data: file } = await supabase
      .from('workspace_files')
      .select('uploaded_by')
      .eq('id', fileId)
      .maybeSingle();

    if (file?.uploaded_by === userId) return true;

    return false;
  },

  async canManageFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (hasCapability(role as any, 'document.manage')) return true;

    const { data: file } = await supabase
      .from('workspace_files')
      .select('uploaded_by')
      .eq('id', fileId)
      .maybeSingle();

    if (file?.uploaded_by === userId) return true;

    return false;
  },

  /** Grant explicit access to a user (no-op since file_access table is deprecated) */
  async shareFile(
    fileId: string,
    targetUserId: string,
    permission: 'view' | 'download' | 'edit' | 'manage' = 'view'
  ): Promise<boolean> {
    return false;
  },

  async revokeAccess(fileId: string, targetUserId: string): Promise<boolean> {
    return false;
  },

  async getFileAccessList(fileId: string) {
    return [];
  },

  // ─── Internal ─────────────────────────────────────────────────────────────
  async _isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', userId)
      .maybeSingle();
    return !!data;
  },
};
