import { Task, Project, Profile } from '../../types';
import { WaitingState } from '../waiting/WaitingStateEngine';

export interface WorkMemory {
  userId: string;
  lastWorkedOn: {
    taskId: string;
    taskName: string;
    durationHours: number;
    actionRoute: string;
    projectId?: string;
    projectName?: string;
  }[];
  pausedWork: {
    taskId: string;
    taskName: string;
    reason: string;
    actionRoute: string;
  }[];
  unfinishedIntentions: {
    title: string;
    reason: string;
    actionRoute: string;
  }[];
  recentDecisions: {
    title: string;
    description: string;
    actionRoute: string;
  }[];
  waitingItems: {
    title: string;
    reason: string;
    actionRoute: string;
  }[];
  suggestedResumePoint?: {
    taskId: string;
    taskName: string;
    reason: string;
    actionRoute: string;
  };
  confidence: 'low' | 'medium' | 'high';
}

export interface PersonalWorkMemoryInputs {
  userId: string;
  tasks: Task[];
  projects: Project[];
  activityLogs: any[];
  workSessions: any[];
  waitingStates: WaitingState[];
}

export function generatePersonalWorkMemory(inputs: PersonalWorkMemoryInputs): WorkMemory {
  const { userId, tasks, projects, activityLogs, workSessions, waitingStates } = inputs;
  
  const memory: WorkMemory = {
    userId,
    lastWorkedOn: [],
    pausedWork: [],
    unfinishedIntentions: [],
    recentDecisions: [],
    waitingItems: [],
    confidence: 'low'
  };

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Last Active Work (from work sessions)
  const recentSessions = workSessions.filter(ws => ws.user_id === userId && new Date(ws.start_time) > twentyFourHoursAgo);
  
  const sessionDurations: Record<string, number> = {};
  for (const session of recentSessions) {
    if (!session.end_time) continue; // Currently active
    const t = tasks.find(t => t.id === session.task_id);
    if (!t) continue;
    const durationHours = (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60 * 60);
    sessionDurations[t.id] = (sessionDurations[t.id] || 0) + durationHours;
  }

  for (const [taskId, duration] of Object.entries(sessionDurations)) {
    const t = tasks.find(t => t.id === taskId);
    if (t) {
      const p = projects.find(p => p.id === t.project_id);
      memory.lastWorkedOn.push({
        taskId,
        taskName: t.name,
        durationHours: Math.round(duration * 10) / 10,
        actionRoute: '/execution/board',
        projectId: p?.id,
        projectName: p?.name
      });
    }
  }

  // 2. Interrupted/Paused Work
  // Tasks with work sessions but not completed, and currently not active
  for (const [taskId, duration] of Object.entries(sessionDurations)) {
    const t = tasks.find(t => t.id === taskId);
    if (t && t.status !== 'done') {
      memory.pausedWork.push({
        taskId,
        taskName: t.name,
        reason: `You stopped after working for ${Math.round(duration * 10) / 10}h`,
        actionRoute: '/execution/board'
      });
    }
  }

  // 3. User Intent Recovery
  const eodSummaries = activityLogs.filter(log => log.user_id === userId && log.action === 'end_of_day_summary');
  const latestSummary = eodSummaries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
  if (latestSummary && latestSummary.metadata?.tomorrow_priorities) {
    const priorities = latestSummary.metadata.tomorrow_priorities as string[];
    priorities.forEach(p => {
      memory.unfinishedIntentions.push({
        title: p,
        reason: 'Planned in your last End of Day Summary',
        actionRoute: '/execution/board'
      });
    });
  }

  // 4. Recent Decisions
  const recentDecisions = activityLogs.filter(log => log.user_id === userId && log.action.includes('decision') && new Date(log.created_at) > twentyFourHoursAgo);
  recentDecisions.forEach(log => {
    memory.recentDecisions.push({
      title: 'Recent Decision',
      description: log.metadata?.decision_title || log.metadata?.reason || 'You made a decision',
      actionRoute: '/workspace/activity'
    });
  });

  // 5. Waiting Context
  const personalWaiting = waitingStates.filter(ws => ws.affectedUsers.includes(userId) && ws.severity !== 'normal');
  personalWaiting.forEach(ws => {
    memory.waitingItems.push({
      title: ws.title,
      reason: `You paused because ${ws.waitingReason} (Waiting on ${ws.waitingForName || 'someone'})`,
      actionRoute: ws.actionRoute
    });
  });

  // Calculate confidence and resume point
  let dataPoints = memory.lastWorkedOn.length + memory.pausedWork.length + memory.unfinishedIntentions.length + memory.waitingItems.length;
  
  if (dataPoints > 4) memory.confidence = 'high';
  else if (dataPoints > 1) memory.confidence = 'medium';
  else memory.confidence = 'low';

  if (memory.unfinishedIntentions.length > 0) {
    // We don't have task IDs for intentions usually, they are just text.
    // Try to match text to task
    const t = tasks.find(task => task.assignee_id === userId && task.status !== 'done' && memory.unfinishedIntentions[0].title.includes(task.name));
    if (t) {
      memory.suggestedResumePoint = {
        taskId: t.id,
        taskName: t.name,
        reason: 'You planned to continue this',
        actionRoute: '/execution/board'
      };
    }
  } else if (memory.pausedWork.length > 0) {
    const pw = memory.pausedWork[0];
    memory.suggestedResumePoint = {
      taskId: pw.taskId,
      taskName: pw.taskName,
      reason: pw.reason,
      actionRoute: pw.actionRoute
    };
  }

  return memory;
}
