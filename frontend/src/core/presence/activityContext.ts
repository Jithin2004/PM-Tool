import type { OperationalState, ActivityEntry, OperationalContext, OperationalIntent } from './types';
import { describeIntent } from './operationalIntent';

interface RawAction {
  action: string;
  metadata?: Record<string, any>;
}

const OPERATIONAL_ACTION_MAP: Record<string, { state: OperationalState; description: string; intent?: OperationalIntent }> = {
  task_created: { state: 'editing', description: 'created a task', intent: 'editing_task' },
  task_updated: { state: 'editing', description: 'updated a task', intent: 'editing_task' },
  task_status_changed: { state: 'reviewing', description: 'changed task status', intent: 'reviewing_execution' },
  task_deleted: { state: 'editing', description: 'removed a task', intent: 'editing_task' },
  task_assigned: { state: 'planning', description: 'assigned a task', intent: 'assigning_workload' },
  epic_created: { state: 'planning', description: 'created an epic', intent: 'refining_epics' },
  epic_updated: { state: 'planning', description: 'updated an epic', intent: 'refining_epics' },
  sprint_created: { state: 'planning', description: 'created a sprint', intent: 'planning_sprint' },
  sprint_started: { state: 'in_sprint', description: 'started a sprint', intent: 'planning_sprint' },
  sprint_completed: { state: 'in_sprint', description: 'completed a sprint', intent: 'reviewing_execution' },
  sprint_goal_updated: { state: 'planning', description: 'updated sprint goal', intent: 'planning_sprint' },
  project_created: { state: 'planning', description: 'created a project', intent: 'general' },
  project_updated: { state: 'planning', description: 'updated project settings', intent: 'general' },
  comment_added: { state: 'reviewing', description: 'added a comment', intent: 'reviewing_execution' },
  dependency_added: { state: 'planning', description: 'mapped a dependency', intent: 'editing_dependencies' },
  dependency_removed: { state: 'planning', description: 'removed a dependency', intent: 'editing_dependencies' },
  blocker_raised: { state: 'reviewing', description: 'raised a blocker', intent: 'blocker_discussion' },
  blocker_resolved: { state: 'reviewing', description: 'resolved a blocker', intent: 'reviewing_blockers' },
  estimation_updated: { state: 'planning', description: 'updated estimates', intent: 'validating_estimates' },
  velocity_updated: { state: 'in_sprint', description: 'updated velocity', intent: 'reviewing_velocity' },
  backlog_refined: { state: 'in_backlog', description: 'refined backlog', intent: 'prioritizing_backlog' },
  sprint_planning: { state: 'planning', description: 'planning sprint', intent: 'sprint_planning' },
  review_completed: { state: 'reviewing', description: 'completed a review', intent: 'reviewing_execution' },
  approval_granted: { state: 'reviewing', description: 'approved', intent: 'reviewing_execution' },
  approval_rejected: { state: 'reviewing', description: 'rejected approval', intent: 'reviewing_execution' },
};

export function translateAction(
  raw: RawAction,
  userId: string,
  username: string,
  context: OperationalContext,
  currentIntent?: OperationalIntent,
): ActivityEntry {
  const mapped = OPERATIONAL_ACTION_MAP[raw.action] || {
    state: 'active' as OperationalState,
    description: raw.action,
  };

  return {
    id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    username,
    action: raw.action,
    operationalState: mapped.state,
    intent: mapped.intent ?? currentIntent ?? 'general',
    description: `${username} ${mapped.description}`,
    context,
    timestamp: new Date().toISOString(),
  };
}

export function batchTranslateActions(
  rawActions: RawAction[],
  userId: string,
  username: string,
  context: OperationalContext,
): ActivityEntry[] {
  return rawActions.map(raw => translateAction(raw, userId, username, context));
}
