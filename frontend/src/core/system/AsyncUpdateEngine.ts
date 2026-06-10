import { Task, Project } from '../../types';

export interface MeetingCheckReport {
  completedTasks: Task[];
  blockedTasks: Task[];
  waitingTasks: Task[];
  pendingDecisions: any[];
  unresolvedCount: number;
  shouldBlockMeeting: boolean;
  suggestion: string;
}

export const AsyncUpdateEngine = {
  /**
   * Generates a report of already known items and unresolved blockers
   * for a given set of meeting participants.
   */
  generateMeetingReport(
    participantIds: string[],
    tasks: Task[],
    projects: Project[],
    decisions: any[]
  ): MeetingCheckReport {
    // If no participants are selected, audit the entire workspace tasks
    const isTargeted = participantIds && participantIds.length > 0;
    
    // Filter tasks assigned to participants
    const filteredTasks = tasks.filter(t => 
      !isTargeted || participantIds.includes(t.assignee_id || '')
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Completed Tasks (completed/done in the last 7 days)
    const completedTasks = filteredTasks.filter(t => {
      const isDoneState = ['completed', 'done', 'verified'].includes(t.status.toLowerCase());
      if (!isDoneState) return false;
      const updatedDate = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
      return updatedDate >= sevenDaysAgo;
    });

    // 2. Blocked Tasks
    const blockedTasks = filteredTasks.filter(t => 
      t.status.toLowerCase() === 'blocked'
    );

    // 3. Waiting Tasks (waiting/in review)
    const waitingTasks = filteredTasks.filter(t => 
      ['waiting', 'in_review', 'needs_review', 'paused'].includes(t.status.toLowerCase())
    );

    // 4. Decisions Needed / Pending Approvals
    // Filter decisions related to participant projects
    const participantProjectIds = Array.from(new Set(filteredTasks.map(t => t.project_id).filter(Boolean)));
    const pendingDecisions = (decisions || []).filter(d => {
      const isPending = ['pending_approval', 'escalated', 'approval_pending'].includes(d.approvalStatus || d.status);
      const isRelated = !isTargeted || (d.affectedProjectIds && d.affectedProjectIds.some((pid: string) => participantProjectIds.includes(pid)));
      return isPending && isRelated;
    });

    const unresolvedCount = blockedTasks.length + waitingTasks.length + pendingDecisions.length;
    const shouldBlockMeeting = unresolvedCount > 0;
    
    const suggestion = shouldBlockMeeting
      ? "Resolve these first: We detected active blocks, waiting states, or pending decisions. Try resolving these asynchronously (via comments or reassignments) before scheduling a sync."
      : "All clear: No active blockers or pending approvals found for these participants. Proceed with scheduling if a meeting is still necessary.";

    return {
      completedTasks,
      blockedTasks,
      waitingTasks,
      pendingDecisions,
      unresolvedCount,
      shouldBlockMeeting,
      suggestion
    };
  }
};
