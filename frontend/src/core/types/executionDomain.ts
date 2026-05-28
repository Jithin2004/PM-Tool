import type { Member } from './workspace';

export type ExecutionCategory = 'ACTIVE' | 'WAITING' | 'BLOCKED' | 'COORDINATION';

export type ExecutionState =
  // ACTIVE Sub-states
  | 'EXECUTING'
  | 'DEPLOYING'
  | 'TESTING'
  | 'VALIDATING'
  // WAITING Sub-states
  | 'WAITING_FOR_CLIENT'
  | 'WAITING_FOR_DATA'
  | 'WAITING_FOR_INFRASTRUCTURE'
  | 'WAITING_FOR_APPROVAL'
  // BLOCKED Sub-states
  | 'BLOCKED_DEPENDENCY'
  | 'BLOCKED_INFRASTRUCTURE'
  | 'BLOCKED_ACCESS'
  // COORDINATION Sub-states
  | 'CLIENT_VERIFICATION'
  | 'RELEASE_WINDOW_PENDING'
  | 'INTERNAL_REVIEW';

export interface BlockerStateLog {
  status: 'created' | 'owner_assigned' | 'resolved';
  timestamp: string;
  actor_id: string;
  notes?: string;
}

export interface ExecutionBlocker {
  id: string;
  workspace_id: string;
  task_id: string;
  category: 'client' | 'data' | 'infrastructure' | 'approval' | 'dependency' | 'access';
  description: string;
  owner_id?: string; // ID of the OperationalActor
  is_critical: boolean;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
  history?: BlockerStateLog[];
}

export interface ExecutionDependency {
  id: string;
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
  status: 'active' | 'resolved';
  created_at: string;
}

export interface ExecutionStream {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  description?: string;
  owner_id?: string; // ID of the OperationalActor
  color: string; // HEX or slate color code
  created_at: string;
  updated_at: string;
}

export interface OperationalActor extends Member {
  focus_factor: number;
  active_stream_id?: string;
  execution_capacity_hours: number;
  efficiency_rating: number;
}
