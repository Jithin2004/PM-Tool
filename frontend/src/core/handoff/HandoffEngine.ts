import { Task } from '../../types';

export interface HandoffContext {
  totalHoursWorked: number;
  lastState: string;
  pendingBlockers: string[];
  recentDecisions: string[];
  incompleteIntentions: string[];
  transferReason?: string;
  handoverNotes?: string;
}

export interface HandoffBrief {
  taskId: string;
  fromUserId: string;
  toUserId: string;
  handoffDate: string;
  context: HandoffContext;
  recommendedActions: string[];
}

export interface HandoffEngineInputs {
  task: Task;
  previousAssigneeId: string;
  newAssigneeId: string;
  workSessions: any[];
  activityLogs: any[];
  blockers: any[];
  transferReason?: string;
  handoverNotes?: string;
}

export function generateHandoffBrief(inputs: HandoffEngineInputs): HandoffBrief {
  const { task, previousAssigneeId, newAssigneeId, workSessions, activityLogs, blockers, transferReason, handoverNotes } = inputs;
  
  // 1. Calculate hours worked by previous owner
  const previousSessions = workSessions.filter(ws => ws.task_id === task.id && ws.user_id === previousAssigneeId);
  let totalHours = 0;
  previousSessions.forEach(ws => {
    if (ws.start_time && ws.end_time) {
      totalHours += (new Date(ws.end_time).getTime() - new Date(ws.start_time).getTime()) / (1000 * 60 * 60);
    }
  });

  // 2. Pending blockers
  const taskBlockers = blockers.filter(b => b.task_id === task.id && !b.resolved);
  const pendingBlockers = taskBlockers.map(b => b.reason);

  // 3. Recent decisions by previous owner
  const taskDecisions = activityLogs.filter(log => log.entity_id === task.id && log.user_id === previousAssigneeId && log.action.includes('decision'));
  const recentDecisions = taskDecisions.map(d => d.metadata?.decision_title || d.metadata?.reason || 'Made a technical decision');

  // 4. Incomplete Intentions
  const taskIntentions = activityLogs.filter(log => log.entity_id === task.id && log.user_id === previousAssigneeId && log.action === 'intention');
  const incompleteIntentions = taskIntentions.map(i => i.metadata?.intention_title || 'Planned next step');

  // 5. Recommended Actions
  const recommendedActions = [];
  if (pendingBlockers.length > 0) {
    recommendedActions.push('Review active blockers that stopped previous owner.');
  }
  if (totalHours > 10) {
    recommendedActions.push('Schedule a quick 5-min sync with previous owner due to high context size.');
  }
  recommendedActions.push('Review the recent decisions made to ensure alignment.');

  return {
    taskId: task.id,
    fromUserId: previousAssigneeId,
    toUserId: newAssigneeId,
    handoffDate: new Date().toISOString(),
    context: {
      totalHoursWorked: Math.round(totalHours * 10) / 10,
      lastState: task.status,
      pendingBlockers,
      recentDecisions,
      incompleteIntentions,
      transferReason,
      handoverNotes
    },
    recommendedActions
  };
}
