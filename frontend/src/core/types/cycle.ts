import type { TaskPriority } from './execution';
import type { ExecutionState } from './execution';
import type { RiskLevel } from './project';
import type { IsoDateTime } from './temporal';

/** Sprint lifecycle — canonical name for time-boxed iterations. */
export type CycleState = 'planned' | 'active' | 'completed' | 'cancelled';

/** @deprecated Use CycleState */
export type SprintStatus = CycleState;

/**
 * Time-boxed delivery cycle (canonical: Sprint).
 * "Cycle" is an alias for product copy / external integrations only.
 */
export interface Sprint {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date: IsoDateTime;
  end_date: IsoDateTime;
  /** Persistence field — semantic alias: CycleState */
  status: CycleState;
  velocity_committed: number;
  velocity_completed: number;
  created_at: string;
  updated_at: string;
}

/** Semantic alias — same entity as Sprint. */
export type Cycle = Sprint;

export type EpicState = 'backlog' | 'in_progress' | 'review' | 'done';

/** @deprecated Use EpicState */
export type EpicStatus = EpicState;

export interface Epic {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  description?: string;
  status: EpicState;
  priority: TaskPriority;
  start_date?: IsoDateTime;
  deadline?: IsoDateTime;
  uid_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  workspace_id: string;
  project_id: string;
  epic_id: string;
  uid?: string;
  title: string;
  description?: string;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserStory {
  id: string;
  workspace_id: string;
  project_id: string;
  epic_id?: string;
  sprint_id?: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  story_points: number;
  priority: TaskPriority;
  pert_best?: number;
  pert_likely?: number;
  pert_worst?: number;
  risk?: RiskLevel;
  confidence?: number;
  assignee_id?: string;
  status: ExecutionState;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  workspace_id: string;
  task_id: string;
  name: string;
  description?: string;
  status: ExecutionState;
  assignee_id?: string;
  estimated_hours: number;
  created_at: string;
  updated_at: string;
}
