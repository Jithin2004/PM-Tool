import type { ExecutionMode } from './execution';
import type { IsoDateTime } from './temporal';

export type ProjectLifecycleState =
  | 'planning'
  | 'active'
  | 'review'
  | 'done'
  | 'archived'
  | 'deployed'
  | 'in-progress';

/** @deprecated Use ProjectLifecycleState in new domain code. */
export type ProjectStatus = ProjectLifecycleState;

export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Workspace-scoped project (portfolio item).
 * Not "workspaceProject" — scope is implied by workspace_id.
 */
export interface Project {
  id: string;
  workspace_id: string;
  client_id?: string;
  team_id?: string;
  owner_id?: string;
  name: string;
  description?: string;
  /** Persistence field — semantic alias: ProjectLifecycleState */
  status: ProjectLifecycleState;
  priority: ProjectPriority;
  template: string;
  execution_mode: ExecutionMode;
  /**
   * @deprecated Legacy mirror of client_deadline. Use getProjectClientDeadline().
   */
  deadline?: IsoDateTime;
  predicted_completion?: IsoDateTime;
  confidence?: number;
  risk?: RiskLevel;
  delay_drift_days: number;
  /** @deprecated Removed in parent-only containerization paradigm. */
  pert_best?: number;
  /** @deprecated Removed in parent-only containerization paradigm. */
  pert_likely?: number;
  /** @deprecated Removed in parent-only containerization paradigm. */
  pert_worst?: number;
  efficiency?: number;
  /** Canonical contractual delivery date (DB: client_deadline). */
  client_deadline?: IsoDateTime;
  proposed_start_date?: IsoDateTime;
  tags?: string[];
  created_at: string;
  updated_at: string;
  audit_header?: {
    created_by: string;
    system_integrity_hash: string;
    is_locked: boolean;
    system_signature: string;
  };
  contract_value?: number;
  billing_model?: 'Fixed Price' | 'Hourly' | 'Milestone Based' | 'Retainer' | 'Internal Project';
  billing_currency?: string;
}
