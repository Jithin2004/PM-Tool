import { trackSupabaseOperation } from '../core/observability/telemetry';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { evaluateTriggers } from './automationEngine';
import { fireEventWebhooks } from './webhookService';
import { logServiceFailure } from '../utils/supabaseError';

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
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'escalated';
  current_step: number;
  initiated_by?: string;
  completed_at?: string;
  created_at: string;
  chain_name?: string;
}

// ── Chains ──

export async function fetchApprovalChains(workspaceId: string): Promise<ApprovalChain[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await trackSupabaseOperation('supabase_from_approval_chains', () => supabase
      .from('approval_chains')
      .select('*').limit(50)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }));
    if (data) return data as ApprovalChain[];
  } catch { /* ignore */ }
  return [];
}

export async function createApprovalChain(chain: Partial<ApprovalChain>): Promise<ApprovalChain | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await trackSupabaseOperation('supabase_from_approval_chains', () => supabase.from('approval_chains').insert(chain).select().single());
    if (data) {
      await activityLogService.appendLog({
        workspace_id: chain.workspace_id!, action: 'approval_created',
        metadata: { chain_id: data.id, name: data.name, trigger_event: data.trigger_event },
      });
      return data as ApprovalChain;
    }
  } catch (error) { logServiceFailure('createApprovalChain', chain, error); }
  return null;
}

export async function updateApprovalChain(chainId: string, updates: Partial<ApprovalChain>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await trackSupabaseOperation('supabase_from_approval_chains', () => supabase.from('approval_chains').update(updates).eq('id', chainId));
    return true;
  } catch { return false; }
}

export async function deleteApprovalChain(chainId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await trackSupabaseOperation('supabase_from_approval_chains', () => supabase.from('approval_chains').update({ enabled: false, deleted_at: new Date().toISOString() }).eq('id', chainId));
    return true;
  } catch { return false; }
}

// ── Steps ──

export async function fetchApprovalSteps(chainId: string): Promise<ApprovalStep[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await trackSupabaseOperation('supabase_from_approval_steps', () => supabase
      .from('approval_steps')
      .select('*').limit(50)
      .eq('chain_id', chainId)
      .order('step_order', { ascending: true }));
    if (data) return data as ApprovalStep[];
  } catch { /* ignore */ }
  return [];
}

export async function addApprovalStep(step: Partial<ApprovalStep>): Promise<ApprovalStep | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await trackSupabaseOperation('supabase_from_approval_steps', () => supabase.from('approval_steps').insert(step).select().single());
    if (data) return data as ApprovalStep;
  } catch { /* ignore */ }
  return null;
}

export async function removeApprovalStep(stepId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await trackSupabaseOperation('supabase_from_approval_steps', () => supabase.from('approval_steps').delete().eq('id', stepId));
    return true;
  } catch { return false; }
}

// ── Instances ──

export async function fetchApprovalInstances(
  workspaceId: string, targetType?: string, targetId?: string
): Promise<ApprovalInstance[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    let query = supabase
      .from('approval_instances')
      .select('*, approval_chains!inner(name)')
      .eq('approval_chains.workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (targetType) query = query.eq('target_type', targetType);
    if (targetId) query = query.eq('target_id', targetId);
    const { data } = await query;
    if (data) {
      return data.map((d: any) => ({
        ...d, chain_name: d.approval_chains?.name,
      })) as ApprovalInstance[];
    }
  } catch { /* ignore */ }
  return [];
}

export async function createApprovalInstance(
  instance: Partial<ApprovalInstance>, workspaceId?: string
): Promise<ApprovalInstance | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await trackSupabaseOperation('supabase_from_approval_instances', () => supabase.from('approval_instances').insert({
      chain_id: instance.chain_id, target_type: instance.target_type, target_id: instance.target_id,
      initiated_by: instance.initiated_by, status: 'pending', current_step: 1,
    }).select().single());
    if (data) {
      const wsId = workspaceId || '';
      await activityLogService.appendLog({
        workspace_id: wsId, action: 'approval_created',
        metadata: { instance_id: data.id, target_type: instance.target_type, target_id: instance.target_id },
      });
      fireEventWebhooks('approval_created', wsId, {
        instance_id: data.id, target_type: instance.target_type, target_id: instance.target_id,
      }).catch(() => {});
      return data as ApprovalInstance;
    }
  } catch (error) { logServiceFailure('createApprovalInstance', instance, error); }
  return null;
}

export async function approveStep(instanceId: string, stepOrder: number, _userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: instance } = await trackSupabaseOperation('supabase_from_approval_instances', () => supabase
      .from('approval_instances').select('*, approval_chains!inner(id)')
      .eq('id', instanceId).single());
    if (!instance) return false;
    const { data: steps } = await trackSupabaseOperation('supabase_from_approval_steps', () => supabase
      .from('approval_steps').select('*').limit(50)
      .eq('chain_id', instance.chain_id)
      .order('step_order', { ascending: true }));
    const totalSteps = steps?.length || 0;
    if (stepOrder >= totalSteps) {
      await trackSupabaseOperation('supabase_from_approval_instances', () => supabase.from('approval_instances').update({
        status: 'approved', current_step: totalSteps, completed_at: new Date().toISOString(),
      }).eq('id', instanceId));
      await activityLogService.appendLog({
        workspace_id: '', action: 'approval_completed',
        metadata: { instance_id: instanceId, target_type: instance.target_type, target_id: instance.target_id, result: 'approved' },
      });
      fireEventWebhooks('approval_completed', instance.workspace_id, {
        instance_id: instanceId, target_type: instance.target_type, target_id: instance.target_id, result: 'approved',
      }).catch(() => {});
      evaluateTriggers('approval.completed', {
        workspace_id: instance.workspace_id, target_type: instance.target_type, target_id: instance.target_id,
      }).catch(() => {});
    } else {
      await trackSupabaseOperation('supabase_from_approval_instances', () => supabase.from('approval_instances').update({
        current_step: stepOrder + 1,
      }).eq('id', instanceId));
    }
    return true;
  } catch { return false; }
}

export async function rejectStep(instanceId: string, _stepOrder: number, _userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: instance } = await trackSupabaseOperation('supabase_from_approval_instances', () => supabase
      .from('approval_instances').select('*').limit(50).eq('id', instanceId).single());
    if (!instance) return false;
    await trackSupabaseOperation('supabase_from_approval_instances', () => supabase.from('approval_instances').update({
      status: 'rejected', completed_at: new Date().toISOString(),
    }).eq('id', instanceId));
    await activityLogService.appendLog({
      workspace_id: '', action: 'approval_completed',
      metadata: { instance_id: instanceId, target_type: instance.target_type, target_id: instance.target_id, result: 'rejected' },
    });
    fireEventWebhooks('approval_completed', instance.workspace_id, {
      instance_id: instanceId, target_type: instance.target_type, target_id: instance.target_id, result: 'rejected',
    }).catch(() => {});
    return true;
  } catch { return false; }
}

export async function requestChanges(instanceId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await trackSupabaseOperation('supabase_from_approval_instances', () => supabase.from('approval_instances').update({
      status: 'changes_requested', current_step: 0,
    }).eq('id', instanceId));
    return true;
  } catch { return false; }
}

// ── Preset chains ──

export const PRESET_CHAINS = [
  { name: 'Requirements Approval', trigger_event: 'document.created', steps: [{ role: 'pm' }, { role: 'super_admin' }] },
  { name: 'QA Approval', trigger_event: 'task.status_changed', steps: [{ role: 'developer' }, { role: 'pm' }] },
  { name: 'Release Approval', trigger_event: 'sprint.completed', steps: [{ role: 'pm' }, { role: 'super_admin' }] },
  { name: 'Budget Approval', trigger_event: 'project.created', steps: [{ role: 'super_admin' }] },
  { name: 'Client Approval', trigger_event: 'task.status_changed', steps: [{ role: 'pm' }] },
  { name: 'Document Approval', trigger_event: 'document.updated', steps: [{ role: 'pm' }, { role: 'super_admin' }] },
];
