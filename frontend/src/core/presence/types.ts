import type { UserRole } from '../../types';

export type OperationalState =
  | 'active'
  | 'idle'
  | 'away'
  | 'reviewing'
  | 'editing'
  | 'planning'
  | 'in_sprint'
  | 'in_backlog'
  | 'in_timeline'
  | 'in_board'
  | 'in_analytics';

export type OperationalSection =
  | 'backlog'
  | 'board'
  | 'sprints'
  | 'timeline'
  | 'workspace'
  | 'control'
  | 'resources'
  | 'setup'
  | 'unknown';

export type OperationalIntent =
  | 'reviewing_blockers'
  | 'editing_task'
  | 'planning_sprint'
  | 'prioritizing_backlog'
  | 'analyzing_dependencies'
  | 'adjusting_timeline'
  | 'assigning_workload'
  | 'reviewing_execution'
  | 'coordinating_release'
  | 'validating_estimates'
  | 'reviewing_risk'
  | 'moving_cards'
  | 'analyzing_overdue'
  | 'creating_stories'
  | 'refining_epics'
  | 'analyzing_critical_path'
  | 'reviewing_dependencies'
  | 'adjusting_milestones'
  | 'reviewing_resource_allocation'
  | 'sprint_planning'
  | 'editing_dependencies'
  | 'blocker_discussion'
  | 'reviewing_metrics'
  | 'reviewing_velocity'
  | 'general';

export interface OperationalContext {
  projectId?: string;
  sprintId?: string;
  epicId?: string;
  taskId?: string;
  section: OperationalSection;
}

export interface OperationalPresence {
  userId: string;
  username: string;
  role: UserRole;
  state: OperationalState;
  context: OperationalContext;
  intent: OperationalIntent;
  onlineAt: string;
  lastActiveAt: string;
  idle: boolean;
}

export interface CollaborationSignal {
  userId: string;
  username: string;
  type: 'editing' | 'reviewing' | 'viewing' | 'planning' | 'blocker' | 'completed';
  context: OperationalContext;
  intent: OperationalIntent;
  timestamp: string;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  operationalState: OperationalState;
  intent: OperationalIntent;
  description: string;
  context: OperationalContext;
  timestamp: string;
}

export type IntentSource = 'route' | 'interaction' | 'modal' | 'drag' | 'edit' | 'mutation' | 'command' | 'focus';

export interface IntentSignal {
  intent: OperationalIntent;
  source: IntentSource;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export type InteractionType =
  | 'card_click'
  | 'card_drag'
  | 'card_drop'
  | 'modal_open'
  | 'modal_close'
  | 'edit_start'
  | 'edit_end'
  | 'command_execute'
  | 'panel_focus'
  | 'task_status_change'
  | 'task_assign'
  | 'task_create'
  | 'dependency_edit'
  | 'sprint_action'
  | 'filter_change'
  | 'sort_change'
  | 'search_focus';
