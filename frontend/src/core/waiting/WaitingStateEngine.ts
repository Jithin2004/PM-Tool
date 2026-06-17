import { Task, Project, Profile } from '../../types';
import { hasFunction } from '../auth/permissions';
export interface WaitingState {
  id: string;
  sourceType: 'task' | 'project' | 'approval' | 'external';
  title: string;
  waitingForUserId?: string;
  waitingForName?: string;
  waitingReason: string;
  waitingSince: string;
  waitingDurationHours: number;
  affectedTasks: Task[];
  affectedUsers: string[];
  affectedProjects: string[];
  severity: 'normal' | 'attention' | 'critical';
  recommendedAction: string;
  actionRoute: string;
}

export interface WaitingStateInputs {
  userId: string;
  role: string;
  tasks: Task[];
  projects: Project[];
  approvals: any[];
  blockers: any[];
  profiles: Profile[];
}

export function generateWaitingStates(inputs: WaitingStateInputs): WaitingState[] {
  const { userId, role, tasks, projects, approvals, blockers, profiles } = inputs;
  const states: WaitingState[] = [];
  const now = new Date();

  // Helper to resolve user name
  const getUserName = (id?: string) => {
    if (!id) return undefined;
    const p = profiles.find(x => x.id === id);
    return p ? p.full_name || p.email : 'Unknown User';
  };

  // 1. Process Execution Blockers
  const activeBlockers = blockers.filter(b => !b.resolved);
  for (const b of activeBlockers) {
    const task = tasks.find(t => t.id === b.task_id);
    if (!task) continue;

    // Determine ownership
    let ownerId = b.owner_id; // If explicit owner exists
    if (!ownerId) ownerId = task.assignee_id; // Assigned task owner
    if (!ownerId) {
      const proj = projects.find(p => p.id === task.project_id);
      ownerId = proj?.owner_id;
    }

    const waitingSince = new Date(b.created_at || now);
    const durationHours = (now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60);

    let severity: 'normal' | 'attention' | 'critical' = 'normal';
    if (durationHours > 72) severity = 'critical';
    else if (durationHours > 24) severity = 'attention';

    if (task.priority === 'urgent' || task.priority === 'high') {
      severity = severity === 'normal' ? 'attention' : 'critical';
    }

    states.push({
      id: `blocker_${b.id}`,
      sourceType: 'task',
      title: task.name,
      waitingForUserId: ownerId,
      waitingForName: getUserName(ownerId),
      waitingReason: b.reason,
      waitingSince: waitingSince.toISOString(),
      waitingDurationHours: durationHours,
      affectedTasks: [task],
      affectedUsers: task.assignee_id ? [task.assignee_id] : [],
      affectedProjects: [task.project_id],
      severity,
      recommendedAction: ownerId ? `Check with ${getUserName(ownerId)}` : 'Assign an owner to resolve this',
      actionRoute: '/execution/board'
    });
  }

  // 2. Process Pending Approvals
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  for (const a of pendingApprovals) {
    const waitingSince = new Date(a.created_at);
    const durationHours = (now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60);

    let severity: 'normal' | 'attention' | 'critical' = 'normal';
    if (durationHours > 72) severity = 'critical';
    else if (durationHours > 24) severity = 'attention';

    states.push({
      id: `approval_${a.id}`,
      sourceType: 'approval',
      title: `${a.entity_type.toUpperCase()} Approval`,
      waitingForUserId: a.requested_from,
      waitingForName: getUserName(a.requested_from),
      waitingReason: a.reason || 'Pending review',
      waitingSince: waitingSince.toISOString(),
      waitingDurationHours: durationHours,
      affectedTasks: [], // Could map if approval metadata has it
      affectedUsers: [a.requested_by],
      affectedProjects: [],
      severity,
      recommendedAction: `Awaiting ${getUserName(a.requested_from)}'s approval`,
      actionRoute: '/workspace/approvals'
    });
  }


  const userProfile = profiles.find(p => p.id === userId);

  // Filter based on function
  if (hasFunction(userProfile, 'Engineering')) {
    return states.filter(s => 
      s.affectedUsers.includes(userId) || 
      s.waitingForUserId === userId
    );
  } else if (hasFunction(userProfile, 'Projects')) {
    const managedProjectIds = projects.filter(p => p.owner_id === userId).map(p => p.id);
    return states.filter(s => 
      s.affectedProjects.some(pid => managedProjectIds.includes(pid)) || 
      s.waitingForUserId === userId ||
      s.affectedUsers.includes(userId)
    );
  }

  // Admins see all
  return states.sort((a, b) => b.waitingDurationHours - a.waitingDurationHours);
}
