import type { RiskLevel } from './project';
import type { IsoDateTime } from './temporal';

export type ExecutionMode = 'KANBAN' | 'SCRUM' | 'HYBRID' | 'SDLC' | 'CUSTOM';

/** Canonical workflow state for executable work items. */
export type ExecutionState =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'completed'
  | 'changes_requested'
  | 'ready_for_review'
  | 'assigned'
  | 'cancelled';

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
  original_estimate?: number;
  current_estimate?: number;
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
  milestone_id?: string;
  definition_of_done?: string;
  acceptance_criteria?: string;
  work_time_hours?: number;
  wait_time_hours?: number;
  cycle_time_hours?: number;
  last_activity_at?: IsoDateTime;
  // Sprint 2.2 Intelligence fields
  discovery_notes?: string;
  blocked_reason?: string;
  completion_notes?: string;
  delay_reason?: string;
  actual_effort_minutes?: number;
  estimated_effort_minutes?: number;
  completed_at?: IsoDateTime;
  deleted_at?: IsoDateTime;
  first_started_at?: IsoDateTime;
  needs_help_from?: string;
  blocked_since?: IsoDateTime;
  completion_evidence_summary?: string;
  completion_evidence_link?: string;
  completion_evidence_pr_url?: string;
  /** Transient field — not persisted, used to pass estimate change reason through updateTask. */
  estimate_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface TaskCollaborator {
  id: string;
  workspace_id: string;
  task_id: string;
  user_id: string;
  added_by?: string;
  reason: string;
  added_at: string;
  removed_at?: string;
}

export type WorkSessionStatus = 'active' | 'paused' | 'completed';
export type WorkSessionType = 'normal' | 'overtime' | 'weekend';

export interface WorkSession {
  id: string;
  workspace_id: string;
  task_id: string;
  user_id: string;
  status: WorkSessionStatus;
  type: WorkSessionType;
  started_at: string;
  paused_at?: string;
  completed_at?: string;
  total_minutes: number;
  duration_minutes?: number;
  session_type?: string;
  entry_type?: string;
  notes?: string;
}

/** @deprecated Use WorkSessionStatus */
export type WorkSessionPause = WorkSessionStatus;

export interface ProductivityIndicators {
  insights: string[];
}
