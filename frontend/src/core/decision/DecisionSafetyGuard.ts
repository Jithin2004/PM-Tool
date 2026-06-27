import { ActionType } from './DecisionIntelligenceEngine';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { hasCapability } from '../auth/permissions';

export interface SafetyValidationResult {
  isSafe: boolean;
  blockReason?: string;
}

export async function validateExecutionSafety(
  actionType: ActionType,
  payload: Record<string, any>,
  workspaceId: string
): Promise<SafetyValidationResult> {
  if (!isSupabaseConfigured) {
    return { isSafe: false, blockReason: 'Database not configured. Safe execution impossible.' };
  }

  try {
    switch (actionType) {
      case 'TASK_REASSIGNMENT':
        return await validateTaskReassignment(payload, workspaceId);
      case 'DEADLINE_ADJUSTMENT':
        return await validateDeadlineAdjustment(payload, workspaceId);
      case 'CAPACITY_REBALANCE':
      case 'BLOCKER_ESCALATION':
      case 'RESOURCE_REQUEST':
      case 'SPRINT_RESCOPE':
      case 'APPROVAL_REQUIRED':
        // Safe to escalate or request by default
        return { isSafe: true };
      default:
        return { isSafe: false, blockReason: `Unknown action type: ${actionType}` };
    }
  } catch (err: any) {
    return { isSafe: false, blockReason: `Safety validation failed: ${err.message}` };
  }
}

async function validateTaskReassignment(payload: any, workspaceId: string): Promise<SafetyValidationResult> {
  const { target_user_id, tasks } = payload;
  if (!target_user_id) return { isSafe: false, blockReason: 'No target operator specified.' };
  
  // 1. Verify user exists in workspace and is active
  const { data: userData } = await supabase
    .from('users')
    .select('role, employment_status, availability_factor')
    .eq('workspace_id', workspaceId)
    .eq('id', target_user_id)
    .single();

  if (!userData) return { isSafe: false, blockReason: 'Target operator not found in workspace.' };
  if (userData.employment_status && userData.employment_status !== 'active') {
    return { isSafe: false, blockReason: `Target operator is ${userData.employment_status}.` };
  }
  
  // 2. Check if on leave
  const { data: leaves } = await supabase
    .from('personal_leave')
    .select('id')
    .eq('user_id', target_user_id)
    .eq('status', 'approved')
    .lte('start_date', new Date().toISOString())
    .gte('end_date', new Date().toISOString());

  if (leaves && leaves.length > 0) {
    return { isSafe: false, blockReason: 'Target operator is currently on approved leave.' };
  }

  // 3. Verify user has the skill/capability to do the tasks
  // Simplification for safety guard: we trust the intelligence engine matched the department, 
  // but we enforce they aren't a 'viewer' or 'client'
  if (!hasCapability(userData.role as any, 'task.update')) {
    return { isSafe: false, blockReason: `Target operator lacks execution permissions (Role: ${userData.role}).` };
  }

  return { isSafe: true };
}

async function validateDeadlineAdjustment(payload: any, workspaceId: string): Promise<SafetyValidationResult> {
  const { target_tasks } = payload;
  if (!target_tasks || target_tasks.length === 0) return { isSafe: false, blockReason: 'No target tasks specified.' };
  
  // 1. Check if tasks belong to milestones that are already billed
  const { data: tasks } = await supabase
    .from('tasks')
    .select('project_id')
    .in('id', target_tasks);

  if (!tasks || tasks.length === 0) return { isSafe: false, blockReason: 'Tasks not found.' };

  const projectIds = [...new Set(tasks.map(t => t.project_id))];
  
  const { data: projects } = await supabase
    .from('projects')
    .select('status')
    .in('id', projectIds);

  if (projects && projects.some(p => p.status === 'deployed' || p.status === 'archived')) {
    return { isSafe: false, blockReason: 'Cannot adjust deadlines on deployed or archived projects.' };
  }

  return { isSafe: true };
}
