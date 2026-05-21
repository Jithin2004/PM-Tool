export interface ApprovalChain {
  id: string;
  workspace_id: string;
  name: string;
  trigger_event?: string;
  trigger_config: Record<string, any>;
  enabled: boolean;
  created_at: string;
}

export interface ApprovalStep {
  id: string;
  chain_id: string;
  step_order: number;
  approver_role: string;
  approver_id?: string;
  timeout_hours: number;
}

export interface ApprovalInstance {
  id: string;
  chain_id: string;
  target_type: string;
  target_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  current_step: number;
  initiated_by?: string;
  completed_at?: string;
  created_at: string;
}

// ---- Stubs ----

export async function fetchApprovalChains(workspaceId: string): Promise<ApprovalChain[]> {
  return [];
}

export async function createApprovalChain(chain: Partial<ApprovalChain>): Promise<ApprovalChain | null> {
  return null;
}

export async function fetchApprovalInstances(workspaceId: string, targetType?: string): Promise<ApprovalInstance[]> {
  return [];
}

export async function approveStep(instanceId: string, stepOrder: number, userId: string): Promise<boolean> {
  return false;
}

export async function rejectStep(instanceId: string, stepOrder: number, userId: string): Promise<boolean> {
  return false;
}
