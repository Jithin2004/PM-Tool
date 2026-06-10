export interface BriefItem {
  id: string;
  title: string;
  reason: string;
  action_route: string;
  type: 'task' | 'blocker' | 'approval' | 'project_risk';
  metadata?: any;
}

export interface DailyBrief {
  greeting: string;
  primaryFocus: BriefItem | null;
  continueWork: BriefItem | null;
  dueToday: BriefItem[];
  blockingOthers: BriefItem[];
  waitingOnOthers: BriefItem[];
  suggestedOrder: BriefItem[];
}

export interface DailyBriefInputs {
  userId: string;
  profileName: string;
  role: string;
  tasks: any[];
  projects: any[];
  approvals: any[];
  blockers: any[];
  workSessions: any[];
}

export function generateDailyBrief(inputs: DailyBriefInputs): DailyBrief {
  const { userId, profileName, role, tasks, projects, approvals, blockers, workSessions } = inputs;
  
  const firstName = profileName?.split(' ')[0] || 'There';
  const greeting = `Good Morning, ${firstName}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const brief: DailyBrief = {
    greeting,
    primaryFocus: null,
    continueWork: null,
    dueToday: [],
    blockingOthers: [],
    waitingOnOthers: [],
    suggestedOrder: []
  };

  // 1. Find active session for Continue Work
  const activeSession = workSessions.find(s => s.user_id === userId && !s.end_time);
  if (activeSession) {
    const activeTask = tasks.find(t => t.id === activeSession.task_id);
    if (activeTask) {
      brief.continueWork = {
        id: `continue-${activeTask.id}`,
        title: activeTask.name,
        reason: 'Currently Running',
        action_route: `/execution/board?task=${activeTask.id}`,
        type: 'task',
        metadata: { estimated: activeTask.estimated_hours }
      };
    }
  }

  // 2. Logic based on role
  if (role === 'developer') {
    const myTasks = tasks.filter(t => t.assignee_id === userId && t.status !== 'done');
    
    // Waiting on Others: My tasks that are blocked
    const myBlockedTasks = myTasks.filter(t => t.status === 'blocked');
    myBlockedTasks.forEach(t => {
      brief.waitingOnOthers.push({
        id: `waiting-${t.id}`,
        title: t.name,
        reason: 'Task is blocked',
        action_route: `/execution/board?task=${t.id}`,
        type: 'task'
      });
    });

    // Due Today
    myTasks.forEach(t => {
      if (t.status === 'blocked') return;
      if (t.end_date) {
        const endDate = new Date(t.end_date);
        if (endDate >= today && endDate < tomorrow) {
          brief.dueToday.push({
            id: `due-${t.id}`,
            title: t.name,
            reason: 'Due Today',
            action_route: `/execution/board?task=${t.id}`,
            type: 'task'
          });
        }
      }
    });

    // Blocking Others: Overdue tasks
    const overdueTasks = myTasks.filter(t => t.status !== 'blocked' && t.end_date && new Date(t.end_date) < today);
    overdueTasks.forEach(t => {
      brief.blockingOthers.push({
        id: `blocking-${t.id}`,
        title: t.name,
        reason: 'Overdue task',
        action_route: `/execution/board?task=${t.id}`,
        type: 'task'
      });
    });

    // Suggested Order: Remaining tasks
    const remainingTasks = myTasks.filter(t => 
      t.status !== 'blocked' && 
      !brief.dueToday.some(d => d.id === `due-${t.id}`) &&
      !brief.blockingOthers.some(b => b.id === `blocking-${t.id}`) &&
      (!activeSession || activeSession.task_id !== t.id)
    );

    // Sort remaining tasks: High priority projects first
    remainingTasks.sort((a, b) => {
      const projA = projects.find(p => p.id === a.project_id);
      const projB = projects.find(p => p.id === b.project_id);
      const prioA = projA?.priority === 'high' ? 1 : 0;
      const prioB = projB?.priority === 'high' ? 1 : 0;
      return prioB - prioA;
    });

    remainingTasks.forEach(t => {
      brief.suggestedOrder.push({
        id: `suggested-${t.id}`,
        title: t.name,
        reason: 'Up Next',
        action_route: `/execution/board?task=${t.id}`,
        type: 'task'
      });
    });

  } else if (role === 'pm' || role === 'super_admin') {
    // PMs/Admins:
    // Waiting on Others: Blockers in the system
    const openBlockers = blockers.filter(b => !b.resolved);
    openBlockers.forEach(b => {
      brief.waitingOnOthers.push({
        id: `blocker-${b.id}`,
        title: b.title || b.description || 'Blocked Task',
        reason: 'Execution Blocked',
        action_route: `/execution/board?task=${b.task_id}`,
        type: 'blocker'
      });
    });

    // Blocking Others: Pending Approvals
    const pendingApprovals = approvals.filter(a => a.status === 'pending');
    pendingApprovals.forEach(a => {
      brief.blockingOthers.push({
        id: `approval-${a.id}`,
        title: `Approval Request: ${a.target_type}`,
        reason: 'Needs Sign-off',
        action_route: `/workspace/approvals`,
        type: 'approval'
      });
    });

    // Due Today / Project Risks: Overdue tasks across projects
    const overdueTasks = tasks.filter(t => t.status !== 'done' && t.end_date && new Date(t.end_date) < today);
    overdueTasks.forEach(t => {
      brief.dueToday.push({
        id: `risk-${t.id}`,
        title: t.name,
        reason: 'Overdue Delivery Risk',
        action_route: `/execution/board?task=${t.id}`,
        type: 'project_risk'
      });
    });

    // Workspace Hygiene
    const unestimatedTasks = tasks.filter(t => t.status !== 'done' && (!t.estimated_hours || t.estimated_hours === 0));
    const unassignedTasks = tasks.filter(t => t.status !== 'done' && !t.assignee_id);
    
    if (unestimatedTasks.length > 0 || unassignedTasks.length > 0) {
      brief.suggestedOrder.push({
        id: 'hygiene',
        title: 'Workspace Hygiene Cleanup',
        reason: `${unestimatedTasks.length} missing estimates, ${unassignedTasks.length} unassigned.`,
        action_route: '/execution',
        type: 'project_risk'
      });
    }
  }

  // 3. Determine Primary Focus
  if (brief.blockingOthers.length > 0) {
    brief.primaryFocus = brief.blockingOthers[0];
  } else if (brief.dueToday.length > 0) {
    brief.primaryFocus = brief.dueToday[0];
  } else if (brief.waitingOnOthers.length > 0 && role !== 'developer') {
    // PM should focus on unblocking
    brief.primaryFocus = brief.waitingOnOthers[0];
  } else if (brief.suggestedOrder.length > 0) {
    brief.primaryFocus = brief.suggestedOrder[0];
  }

  // Deduplicate Primary Focus from lists
  if (brief.primaryFocus) {
    const pfId = brief.primaryFocus.id;
    brief.blockingOthers = brief.blockingOthers.filter(i => i.id !== pfId);
    brief.dueToday = brief.dueToday.filter(i => i.id !== pfId);
    brief.waitingOnOthers = brief.waitingOnOthers.filter(i => i.id !== pfId);
    brief.suggestedOrder = brief.suggestedOrder.filter(i => i.id !== pfId);
  }

  return brief;
}
