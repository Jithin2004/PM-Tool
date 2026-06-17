import { supabase } from '../../lib/supabase';
import { Task, Project, UserRole } from '../../types';
import { getAuthorityRank } from '../auth/permissions';

export interface ContinuityBrief {
  absenceDetected: boolean;
  awayDurationHours: number;
  mode: 'normal' | 'catch-up' | 'deep-reorientation';
  
  // High-level stats
  lastWorkedOn: Task[];
  changesWhileAway: {
    type: 'assignment' | 'priority' | 'comment' | 'blocker' | 'approval';
    description: string;
    timestamp: string;
    entityId?: string;
    taskId?: string;
    route?: string;
  }[];
  
  // Specific collections for scoping
  becameUrgent: Task[];
  newAssignments: Task[];
  newBlockers: any[];
  waitingForUser: any[];
  
  // Ordered sequence for the user to tackle
  recommendedStartOrder: {
    id: string;
    type: 'blocker_others' | 'overdue' | 'critical_update' | 'unfinished' | 'planned';
    title: string;
    description: string;
    taskId?: string;
  }[];
}

export interface ContinuityInputs {
  userId: string;
  workspaceId: string;
  role: UserRole;
  tasks: Task[];
  projects: Project[];
  blockers: any[];
  approvals: any[];
}

export async function generateContinuityBrief(inputs: ContinuityInputs): Promise<ContinuityBrief> {
  const { userId, workspaceId, role, tasks, projects, blockers, approvals } = inputs;
  
  // 1. Detect user's last active timestamp
  const { data: lastLog } = await supabase
    .from('activity_logs')
    .select('created_at, metadata')
    .eq('actor_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('action', 'end_of_day_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let lastActiveStr = lastLog?.created_at;
  let endOfDayPriorities: any[] = [];
  if (lastLog?.metadata?.tomorrow_priorities) {
    endOfDayPriorities = lastLog.metadata.tomorrow_priorities;
  }
  
  if (!lastActiveStr) {
    // Fallback to any latest log
    const { data: anyLog } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('actor_id', userId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    lastActiveStr = anyLog?.created_at;
  }

  // If brand new user with no logs, simulate just starting.
  const lastActive = lastActiveStr ? new Date(lastActiveStr) : new Date();
  const now = new Date();
  const gapMs = now.getTime() - lastActive.getTime();
  const gapHours = gapMs / (1000 * 60 * 60);

  // 2. Calculate Gap Mode
  let mode: ContinuityBrief['mode'] = 'normal';
  if (gapHours > 72) {
    mode = 'deep-reorientation';
  } else if (gapHours > 24) {
    mode = 'catch-up';
  }

  const brief: ContinuityBrief = {
    absenceDetected: gapHours > 12, // Arbitrary threshold to say "welcome back" vs "you just refreshed"
    awayDurationHours: Math.round(gapHours),
    mode,
    lastWorkedOn: [],
    changesWhileAway: [],
    becameUrgent: [],
    newAssignments: [],
    newBlockers: [],
    waitingForUser: [],
    recommendedStartOrder: []
  };

  // Skip deep analysis if it's just a coffee break (< 4 hours)
  if (gapHours < 4) {
    return brief;
  }


  const rank = getAuthorityRank(role);

  // 3. Filter Context based on Role
  let scopedTasks = tasks;
  if (rank <= getAuthorityRank('developer') || rank >= getAuthorityRank('admin')) {
    scopedTasks = tasks.filter(t => t.assignee_id === userId);
  } else if (rank === getAuthorityRank('manager')) {
    const managedProjectIds = new Set(projects.filter(p => p.owner_id === userId).map(p => p.id));
    scopedTasks = tasks.filter(t => managedProjectIds.has(t.project_id) || t.assignee_id === userId);
  }
  // super_admin sees org-wide blockers via the blockers array, but their scoped tasks are private

  // 4. Analyze Changes While Away
  const changes = [];
  
  // New Assignments & Priority Changes
  for (const t of scopedTasks) {
    const taskUpdated = new Date(t.updated_at || t.created_at);
    const taskCreated = new Date(t.created_at);

    if (taskCreated > lastActive && t.assignee_id === userId) {
      brief.newAssignments.push(t);
      changes.push({
        type: 'assignment' as const,
        description: `You were assigned: ${t.name}`,
        timestamp: t.created_at,
        taskId: t.id
      });
    }

    if (taskUpdated > lastActive && (t.priority === 'urgent' || t.priority === 'high')) {
      brief.becameUrgent.push(t);
      changes.push({
        type: 'priority' as const,
        description: `${t.name} became ${t.priority} priority`,
        timestamp: t.updated_at,
        taskId: t.id
      });
    }
  }

  // New Blockers
  for (const b of blockers) {
    const bCreated = new Date(b.created_at || now);
    if (bCreated > lastActive && !b.resolved) {
      // Check if it affects the user
      const task = tasks.find(t => t.id === b.task_id);
      if (task && (rank >= getAuthorityRank('admin') || task.assignee_id === userId || (rank === getAuthorityRank('manager') && projects.find(p => p.id === task.project_id)?.owner_id === userId))) {
        brief.newBlockers.push(b);
        changes.push({
          type: 'blocker' as const,
          description: `New blocker on ${task.name}: ${b.reason}`,
          timestamp: b.created_at,
          taskId: b.task_id
        });
      }
    }
  }

  // Waiting Approvals
  const userApprovals = approvals.filter(a => a.requested_from === userId && a.status === 'pending');
  brief.waitingForUser = userApprovals;
  for (const a of userApprovals) {
    const aCreated = new Date(a.created_at);
    if (aCreated > lastActive) {
      changes.push({
        type: 'approval' as const,
        description: `Approval requested: ${a.reason || a.entity_type}`,
        timestamp: a.created_at,
        route: '/workspace/approvals'
      });
    }
  }

  brief.changesWhileAway = changes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Last worked on (From before the gap)
  const myIncomplete = tasks.filter(t => t.assignee_id === userId && t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled');
  brief.lastWorkedOn = myIncomplete
    .filter(t => new Date(t.updated_at || t.created_at) <= lastActive)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 3);

  // 5. Build Recommended Start Order Pipeline
  const pushOrder = (type: 'blocker_others' | 'overdue' | 'critical_update' | 'unfinished' | 'planned', title: string, desc: string, taskId?: string) => {
    // Avoid duplicates
    if (!brief.recommendedStartOrder.find(r => r.taskId === taskId && r.taskId !== undefined)) {
      brief.recommendedStartOrder.push({ id: Math.random().toString(), type, title, description: desc, taskId });
    }
  };

  // Priority 1: Items blocking others (We are the blocker or our task is blocking someone else)
  // Simplification: if user has a task that is a dependency for others, and it's not done.
  // We don't have dependencies explicitly in `ContinuityInputs` here, but we can look at approvals waiting for user.
  for (const a of brief.waitingForUser) {
    pushOrder('blocker_others', `Pending Approval`, `Teammates are waiting for your approval on ${a.entity_type}`);
  }

  // Priority 2: Overdue Tasks
  const overdueTasks = myIncomplete.filter(t => t.deadline && new Date(t.deadline) < now);
  for (const t of overdueTasks) {
    pushOrder('overdue', t.name, 'This task is past its deadline.', t.id);
  }

  // Priority 3: Critical updates while away
  for (const c of brief.changesWhileAway.filter(c => c.type === 'priority' || c.type === 'blocker')) {
    if (c.taskId) {
      const t = tasks.find(x => x.id === c.taskId);
      if (t && t.assignee_id === userId && t.status !== 'done') {
        pushOrder('critical_update', t.name, c.description, t.id);
      }
    }
  }

  // Priority 3.5: End of Day Summary Priorities
  for (const p of endOfDayPriorities) {
    const t = tasks.find(x => x.id === p.id);
    if (t && t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled') {
      pushOrder('unfinished', t.name, 'You prioritized this at the end of your last session.', t.id);
    }
  }

  // Priority 4: Existing unfinished work (from last worked on)
  for (const t of brief.lastWorkedOn) {
    pushOrder('unfinished', t.name, 'Pick up where you left off.', t.id);
  }

  // Priority 5: Today's normal planned work
  // Ensure we don't show normal tasks that are currently blocked
  const plannedTasks = myIncomplete.filter(t => {
    const isBlocked = blockers.some(b => b.task_id === t.id && !b.resolved);
    const isAlreadyRecommended = brief.recommendedStartOrder.find(r => r.taskId === t.id);
    return !isBlocked && !isAlreadyRecommended;
  });

  for (const t of plannedTasks.slice(0, 3)) {
    pushOrder('planned', t.name, 'Up next in your queue.', t.id);
  }

  return brief;
}
