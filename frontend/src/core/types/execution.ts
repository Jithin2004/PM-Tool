import type { RiskLevel } from './project';
import type { IsoDateTime } from './temporal';

export type ExecutionMode = 'KANBAN' | 'SCRUM' | 'HYBRID' | 'SDLC' | 'CUSTOM';

/** Canonical workflow state for executable work items. */
export type ExecutionState = 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';

/** @deprecated Use ExecutionState in new domain code. */
export type TaskStatus = ExecutionState;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Executable work item (domain: Task).
 * "Execution" refers to the delivery module/routes — not this entity name.
 */
export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  assignee_id?: string;
  name: string;
  description?: string;
  /** Persistence column — semantic meaning: ExecutionState */
  status: ExecutionState;
  priority: TaskPriority;
  start_date?: IsoDateTime;
  /** Canonical target end date. */
  deadline?: IsoDateTime;
  /**
   * Legacy DB / UI field — always mirrored from deadline after normalization.
   * @deprecated Read via getTaskDeadline() or deadline.
   */
  due_date?: IsoDateTime;
  estimated_hours: number;
  pert_best?: number;
  pert_likely?: number;
  pert_worst?: number;
  predicted_completion?: IsoDateTime;
  confidence?: number;
  risk?: RiskLevel;
  delay_drift_days: number;
  story_points?: number;
  epic_id?: string;
  sprint_id?: string;
  story_id?: string;
  parent_task_id?: string;
  definition_of_done?: string;
  acceptance_criteria?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
}
