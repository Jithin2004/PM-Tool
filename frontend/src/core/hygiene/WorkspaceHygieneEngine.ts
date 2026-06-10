import { Task, Project } from '../../types';

export interface HygieneIssue {
  id: string;
  type: 'stale_task' | 'abandoned_project' | 'orphan_task' | 'stale_blocker' | 'missing_owner' | 'forgotten_approval';
  title: string;
  severity: 'low' | 'medium' | 'high';
  detectedReason: string;
  recommendedFix: string;
  safeAction: string;
  actionRoute: string;
}

export interface HygieneEngineInputs {
  tasks: Task[];
  projects: Project[];
  blockers: any[];
  approvals: any[];
}

export function generateWorkspaceHygiene(inputs: HygieneEngineInputs): HygieneIssue[] {
  const { tasks, projects, blockers, approvals } = inputs;
  const issues: HygieneIssue[] = [];
  const now = new Date();

  const getDaysAgo = (dateStr: string) => {
    return (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  };

  // 1. Stale Tasks & Missing Owners
  tasks.forEach(task => {
    if (task.status === 'done') return;

    // Missing Owner
    if (!task.assignee_id) {
      issues.push({
        id: `missing_owner_${task.id}`,
        type: 'missing_owner',
        title: `Unassigned Task: ${task.name}`,
        severity: 'high',
        detectedReason: 'Task has no assignee',
        recommendedFix: 'Assign an owner to take responsibility.',
        safeAction: 'Assign Owner',
        actionRoute: `/execution/board`
      });
    }

    // Stale Task
    if (task.updated_at) {
      const daysSinceUpdate = getDaysAgo(task.updated_at);
      if (daysSinceUpdate > 14) {
        issues.push({
          id: `stale_task_${task.id}`,
          type: 'stale_task',
          title: `Stale Task: ${task.name}`,
          severity: daysSinceUpdate > 30 ? 'high' : 'medium',
          detectedReason: `No movement for ${Math.floor(daysSinceUpdate)} days`,
          recommendedFix: 'Check if this is still relevant or if the owner is blocked.',
          safeAction: 'Review Task',
          actionRoute: `/execution/board`
        });
      }
    }
  });

  // 2. Abandoned Projects
  projects.forEach(project => {
    if (project.status === 'done' || project.status === 'archived') return;

    if (project.updated_at) {
      const daysSinceUpdate = getDaysAgo(project.updated_at);
      if (daysSinceUpdate > 30) {
        issues.push({
          id: `abandoned_proj_${project.id}`,
          type: 'abandoned_project',
          title: `Abandoned Project: ${project.name}`,
          severity: 'high',
          detectedReason: `No project activity for ${Math.floor(daysSinceUpdate)} days`,
          recommendedFix: 'Follow up with project manager or archive the project.',
          safeAction: 'Archive / Remind',
          actionRoute: `/workspace`
        });
      }
    }
  });

  // 3. Forgotten Blockers
  const activeBlockers = blockers.filter(b => !b.resolved);
  activeBlockers.forEach(b => {
    const daysBlocked = getDaysAgo(b.created_at || new Date().toISOString());
    if (daysBlocked > 7) {
      const task = tasks.find(t => t.id === b.task_id);
      issues.push({
        id: `forgotten_blocker_${b.id}`,
        type: 'stale_blocker',
        title: `Forgotten Blocker on ${task?.name || 'Task'}`,
        severity: 'high',
        detectedReason: `Blocked for ${Math.floor(daysBlocked)} days`,
        recommendedFix: 'Escalate to leadership to unblock this item.',
        safeAction: 'Escalate',
        actionRoute: `/execution/board`
      });
    }
  });

  // 4. Approval Rot
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  pendingApprovals.forEach(a => {
    const daysPending = getDaysAgo(a.created_at || new Date().toISOString());
    if (daysPending > 5) {
      issues.push({
        id: `forgotten_approval_${a.id}`,
        type: 'forgotten_approval',
        title: `Stale ${a.entity_type} Approval`,
        severity: daysPending > 14 ? 'high' : 'medium',
        detectedReason: `Pending for ${Math.floor(daysPending)} days`,
        recommendedFix: 'Send a reminder to the reviewer.',
        safeAction: 'Send Reminder',
        actionRoute: `/workspace/approvals`
      });
    }
  });

  return issues.sort((a, b) => {
    const weights = { high: 3, medium: 2, low: 1 };
    return weights[b.severity] - weights[a.severity];
  });
}
