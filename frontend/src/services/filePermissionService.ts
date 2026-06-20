import { supabase } from '../lib/supabase';

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
  const elevated = ['owner', 'admin', 'super_admin'];
  if (elevated.includes(role)) return true;
  if (scope === 'hr') return role === 'hr';
  if (scope === 'finance') return role === 'finance';
  return false;
}

export const filePermissionService = {
  /**
   * Full permission resolution chain:
   * 1. Owner / Admin  → always allowed
   * 2. Uploader       → always allowed for their own file
   * 3. Explicit file_access grant
   * 4. Inherited from linked entity (with HR/Finance scope guard)
   * 5. Workspace member fallback for non-sensitive files
   */
  async canViewFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (['owner', 'admin', 'super_admin'].includes(role)) return true;

    const { data: file } = await supabase
      .from('files')
      .select('uploaded_by, workspace_id')
      .eq('id', fileId)
      .maybeSingle();

    if (!file) return false;

    // 2. Uploader
    if (file.uploaded_by === userId) return true;

    // 3. Explicit access grant
    const { data: access } = await supabase
      .from('file_access')
      .select('permission')
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .maybeSingle();

    if (access) return true;

    // 4. Inherited entity permission
    const { data: links } = await supabase
      .from('file_links')
      .select('entity_type, entity_id')
      .eq('file_id', fileId);

    if (links && links.length > 0) {
      for (const link of links) {
        const scope = detectScope(link.entity_type);
        if (scope !== 'none' && !hasSensitiveCapability(role, scope)) continue;
        // Entity-linked and user has scope → allow
        if (await this._isWorkspaceMember(file.workspace_id, userId)) return true;
      }
    }

    // 5. Workspace member fallback (non-sensitive only)
    const { data: allLinks } = await supabase
      .from('file_links')
      .select('entity_type')
      .eq('file_id', fileId);

    const isSensitive = (allLinks || []).some(l =>
      detectScope(l.entity_type) !== 'none'
    );

    if (isSensitive) return false;
    return this._isWorkspaceMember(file.workspace_id, userId);
  },

  async canEditFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (['owner', 'admin', 'super_admin'].includes(role)) return true;

    const { data: file } = await supabase
      .from('files')
      .select('uploaded_by')
      .eq('id', fileId)
      .maybeSingle();

    if (file?.uploaded_by === userId) return true;

    const { data: access } = await supabase
      .from('file_access')
      .select('permission')
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .maybeSingle();

    return !!(access && ['edit', 'manage'].includes(access.permission));
  },

  async canManageFile(fileId: string, userId: string, role: string): Promise<boolean> {
    if (['owner', 'admin', 'super_admin'].includes(role)) return true;

    const { data: file } = await supabase
      .from('files')
      .select('uploaded_by')
      .eq('id', fileId)
      .maybeSingle();

    if (file?.uploaded_by === userId) return true;

    const { data: access } = await supabase
      .from('file_access')
      .select('permission')
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .maybeSingle();

    return access?.permission === 'manage';
  },

  /** Grant explicit access to a user */
  async shareFile(
    fileId: string,
    targetUserId: string,
    permission: 'view' | 'download' | 'edit' | 'manage' = 'view'
  ): Promise<boolean> {
    const { error } = await supabase.from('file_access').upsert({
      file_id: fileId,
      user_id: targetUserId,
      permission,
    }, { onConflict: 'file_id,user_id' });
    return !error;
  },

  async revokeAccess(fileId: string, targetUserId: string): Promise<boolean> {
    const { error } = await supabase
      .from('file_access')
      .delete()
      .eq('file_id', fileId)
      .eq('user_id', targetUserId);
    return !error;
  },

  async getFileAccessList(fileId: string) {
    const { data } = await supabase
      .from('file_access')
      .select('*, user:users!file_access_user_id_fkey(id, full_name, avatar_url, email)')
      .eq('file_id', fileId);
    return data || [];
  },

  // ─── Internal ─────────────────────────────────────────────────────────────
  async _isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  },
};
