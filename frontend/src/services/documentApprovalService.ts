import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';

export const documentApprovalService = {
  async requestApproval(documentId: string, versionId: string, workspaceId: string, reviewerIds: string[], notes: string): Promise<boolean> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return false;

      // 1. Update doc status to review
      await supabase.from('documents').update({ status: 'review' }).eq('id', documentId);

      // 2. Insert universal_approvals
      const approvalPayloads = reviewerIds.map(reviewerId => ({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        entity_type: 'document',
        entity_id: documentId,
        version_id: versionId, // Assuming universal_approvals supports version_id or we store in metadata
        metadata: { version_id: versionId, notes },
        requested_by: userId,
        reviewer_id: reviewerId,
        status: 'pending'
      }));

      const { error } = await supabase.from('universal_approvals').insert(approvalPayloads);
      if (error) throw error;

      return true;
    } catch (err) {
      console.error('[documentApprovalService.requestApproval] Error:', err);
      return false;
    }
  },

  async approveDocument(approvalId: string, documentId: string, versionId: string): Promise<boolean> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return false;

      // 1. Update approval
      const { error: appError } = await supabase.from('universal_approvals')
        .update({ status: 'approved', responded_at: new Date().toISOString() })
        .eq('id', approvalId);
      if (appError) throw appError;

      // 2. Lock the version & mark approved
      await supabase.from('document_versions')
        .update({ is_locked: true, approved_at: new Date().toISOString(), approved_by: userId })
        .eq('id', versionId);

      // 3. Mark document as approved
      await supabase.from('documents')
        .update({ status: 'approved' })
        .eq('id', documentId);

      // 4. Activity
      const { data: doc } = await supabase.from('documents').select('workspace_id, title').eq('id', documentId).single();
      if (doc) {
        await activityEventService.recordActivity({
          workspace_id: doc.workspace_id,
          actor_id: userId,
          action_type: 'document_approved',
          entity_type: 'document',
          entity_id: documentId,
          metadata: { version_id: versionId, title: doc.title }
        });
      }

      return true;
    } catch (err) {
      console.error('[documentApprovalService.approveDocument] Error:', err);
      return false;
    }
  },

  async rejectDocument(approvalId: string, documentId: string, notes: string): Promise<boolean> {
    try {
      // 1. Update approval
      const { error: appError } = await supabase.from('universal_approvals')
        .update({ status: 'rejected', responded_at: new Date().toISOString(), metadata: { rejection_notes: notes } })
        .eq('id', approvalId);
      if (appError) throw appError;

      // 2. Mark document as draft (returned)
      await supabase.from('documents')
        .update({ status: 'draft' })
        .eq('id', documentId);

      return true;
    } catch (err) {
      console.error('[documentApprovalService.rejectDocument] Error:', err);
      return false;
    }
  }
};
