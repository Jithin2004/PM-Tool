import { supabase } from '../lib/supabase';

export const documentPermissionService = {
  async canViewDocument(documentId: string): Promise<boolean> {
    try {
      // Postgres RPC `can_view_document` implicitly checks this when we query `documents` table via RLS.
      // But we can do an explicit check if we just fetch the doc, if it returns, they can view it.
      const { data, error } = await supabase.from('documents').select('id').eq('id', documentId).single();
      return !!data && !error;
    } catch {
      return false;
    }
  },

  async canEditDocument(documentId: string): Promise<boolean> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return false;

      const { data: doc } = await supabase.from('documents').select('owner_id, workspace_id').eq('id', documentId).single();
      if (!doc) return false;

      if (doc.owner_id === userId) return true;

      const { data: userRole } = await supabase.from('users').select('role').eq('id', userId).eq('workspace_id', doc.workspace_id).single();
      if (userRole && ['owner', 'admin', 'super_admin'].includes(userRole.role)) return true;

      const { data: access } = await supabase.from('document_access').select('permission').eq('document_id', documentId).eq('user_id', userId).single();
      if (access && ['edit', 'approve'].includes(access.permission)) return true;

      return false;
    } catch {
      return false;
    }
  },

  async canApproveDocument(documentId: string): Promise<boolean> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return false;

      const { data: doc } = await supabase.from('documents').select('owner_id, workspace_id').eq('id', documentId).single();
      if (!doc) return false;

      const { data: userRole } = await supabase.from('users').select('role').eq('id', userId).eq('workspace_id', doc.workspace_id).single();
      if (userRole && ['owner', 'admin', 'super_admin'].includes(userRole.role)) return true;

      const { data: access } = await supabase.from('document_access').select('permission').eq('document_id', documentId).eq('user_id', userId).single();
      if (access && access.permission === 'approve') return true;

      return false;
    } catch {
      return false;
    }
  },

  async shareDocument(documentId: string, userId: string, permission: 'view' | 'comment' | 'edit' | 'approve'): Promise<boolean> {
    try {
      // UPSERT document access
      const { error } = await supabase.from('document_access').upsert({
        document_id: documentId,
        user_id: userId,
        permission
      });
      return !error;
    } catch {
      return false;
    }
  }
};
