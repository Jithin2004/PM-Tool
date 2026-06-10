import { supabase } from '../../lib/supabase';

export interface HandoffAuditReport {
  userId: string;
  activeTasks: any[];
  ownedProjects: any[];
  pendingApprovals: any[];
  ownedFiles: any[];
  unansweredMentions: any[];
}

export const ExitHandoffEngine = {
  /**
   * Compiles all items owned or assigned to a resigning/terminated employee.
   */
  async generateHandoffReport(workspaceId: string, userId: string): Promise<HandoffAuditReport> {
    const report: HandoffAuditReport = {
      userId,
      activeTasks: [],
      ownedProjects: [],
      pendingApprovals: [],
      ownedFiles: [],
      unansweredMentions: [],
    };

    try {
      // 1. Fetch active tasks assigned to the user
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, name, description, status, project_id')
        .eq('workspace_id', workspaceId)
        .eq('assignee_id', userId)
        .not('status', 'in', '("completed","done","verified","cancelled")');

      if (!tasksError && tasks) {
        report.activeTasks = tasks;
      }

      // 2. Fetch projects owned by the user
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, description, status')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', userId)
        .not('status', 'in', '("completed","done","archived")');

      if (!projectsError && projects) {
        report.ownedProjects = projects;
      }

      // 3. Fetch pending approvals assigned to the user
      const { data: approvals, error: approvalsError } = await supabase
        .from('approvals')
        .select('id, project_id, phase, status')
        .eq('workspace_id', workspaceId)
        .eq('approver_id', userId)
        .eq('status', 'pending');

      if (!approvalsError && approvals) {
        report.pendingApprovals = approvals;
      }

      // 4. Fetch files owned/uploaded by the user
      const { data: files, error: filesError } = await supabase
        .from('workspace_files')
        .select('id, file_name, file_type, file_size, entity_type, entity_id')
        .eq('workspace_id', workspaceId)
        .eq('uploaded_by', userId)
        .is('deleted_at', null);

      if (!filesError && files) {
        report.ownedFiles = files;
      }

      // 5. Fetch unanswered mentions (needs response)
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('id, task_id, content, metadata')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (!commentsError && comments) {
        report.unansweredMentions = comments.filter(c => {
          const mentions = c.metadata?.mentions || [];
          const userMention = mentions.find((m: any) => m.target_user === userId);
          return userMention && userMention.requires_response && c.metadata?.needs_response === 'Needs Response';
        });
      }

    } catch (err) {
      console.error('Error generating exit handoff report:', err);
    }

    return report;
  },

  /**
   * Transfers ownership/assignments of tasks, projects, approvals to a new owner.
   */
  async transferOwnership(
    workspaceId: string,
    resigningUserId: string,
    newOwnerId: string,
    transfers: {
      taskIds?: string[];
      projectIds?: string[];
      approvalIds?: string[];
      fileIds?: string[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Transfer tasks
      if (transfers.taskIds && transfers.taskIds.length > 0) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ assignee_id: newOwnerId, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .eq('assignee_id', resigningUserId)
          .in('id', transfers.taskIds);
        if (taskError) throw taskError;
      }

      // Transfer projects
      if (transfers.projectIds && transfers.projectIds.length > 0) {
        const { error: projectError } = await supabase
          .from('projects')
          .update({ owner_id: newOwnerId, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .eq('owner_id', resigningUserId)
          .in('id', transfers.projectIds);
        if (projectError) throw projectError;
      }

      // Transfer approvals
      if (transfers.approvalIds && transfers.approvalIds.length > 0) {
        const { error: approvalError } = await supabase
          .from('approvals')
          .update({ approver_id: newOwnerId })
          .eq('workspace_id', workspaceId)
          .eq('approver_id', resigningUserId)
          .in('id', transfers.approvalIds);
        if (approvalError) throw approvalError;
      }

      // Transfer files (change uploader, keep history intact)
      if (transfers.fileIds && transfers.fileIds.length > 0) {
        const { error: fileError } = await supabase
          .from('workspace_files')
          .update({ uploaded_by: newOwnerId, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .eq('uploaded_by', resigningUserId)
          .in('id', transfers.fileIds);
        if (fileError) throw fileError;
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error during ownership transfer:', err);
      return { success: false, error: err.message || 'Transfer failed.' };
    }
  },

  /**
   * Sets the user status to resigned or terminated.
   */
  async updateEmploymentStatus(
    workspaceId: string,
    userId: string,
    status: 'resigned' | 'terminated',
    actorId: string
  ): Promise<boolean> {
    try {
      // 1. Update employment_records
      const { error: recordError } = await supabase
        .from('employment_records')
        .update({ 
          employment_status: status, 
          left_at: new Date().toISOString() 
        })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (recordError) throw recordError;

      // 2. Also log employment change event
      await supabase.from('employment_change_logs').insert({
        employee_id: userId,
        field_changed: 'employment_status',
        previous_value: 'active',
        new_value: status,
        changed_by: actorId,
        reason: 'Employee exit handoff processed'
      });

      return true;
    } catch (err) {
      console.error('Failed to update employment status:', err);
      return false;
    }
  }
};
