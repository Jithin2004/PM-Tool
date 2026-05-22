import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logServiceFailure } from '../utils/supabaseError';
import { activityLogService } from './activityLogService';
import { enqueueSync } from './integrationService';
import { fireEventWebhooks } from './webhookService';

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  trigger_event: string;
  trigger_filters: Record<string, any>;
  actions: any[];
  enabled: boolean;
  created_at: string;
  last_executed_at?: string;
  execution_count?: number;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  trigger_event: string;
  actions: any[];
  icon: string;
}

export type TriggerEvent =
  | 'task.created' | 'task.status_changed' | 'task.assigned' | 'task.completed'
  | 'task.blocked' | 'project.created' | 'project.status_changed'
  | 'sprint.started' | 'sprint.completed'
  | 'approval.completed' | 'approval.created'
  | 'document.created' | 'document.updated'
  | 'comment.added' | 'leave.approved'
  | 'calendar_event.added'
  | 'integration_sync.completed';

// ── CRUD ──

export async function fetchAutomationRules(workspaceId: string): Promise<AutomationRule[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (data) return data as AutomationRule[];
  } catch { /* ignore */ }
  return [];
}

export async function createAutomationRule(rule: Partial<AutomationRule>): Promise<AutomationRule | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('automation_rules').insert(rule).select().single();
    if (error) {
      logServiceFailure('createAutomationRule', rule, error);
    }
    if (data) {
      await activityLogService.appendLog({
        workspace_id: rule.workspace_id!, action: 'automation_created',
        metadata: { rule_id: data.id, name: data.name, trigger_event: data.trigger_event },
      });
      return data as AutomationRule;
    }
  } catch (err) { logServiceFailure('createAutomationRule', rule, err); }
  return null;
}

export async function toggleAutomationRule(ruleId: string, enabled: boolean): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('automation_rules').update({ enabled }).eq('id', ruleId);
    return true;
  } catch { return false; }
}

export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('automation_rules').update({ enabled: false }).eq('id', ruleId);
    return true;
  } catch { return false; }
}

// ── Templates ──

export async function fetchTemplates(): Promise<AutomationTemplate[]> {
  if (!isSupabaseConfigured) return BUILTIN_TEMPLATES;
  try {
    const { data } = await supabase.from('automation_templates').select('*').order('category');
    if (data && data.length > 0) {
      const seen = new Set<string>();
      for (const t of BUILTIN_TEMPLATES) { seen.add(t.id); }
      for (const t of data as AutomationTemplate[]) { if (!seen.has(t.id)) BUILTIN_TEMPLATES.push(t); seen.add(t.id); }
    }
  } catch { /* ignore */ }
  return BUILTIN_TEMPLATES;
}

export async function installTemplate(template: AutomationTemplate, workspaceId: string): Promise<AutomationRule | null> {
  return createAutomationRule({
    workspace_id: workspaceId, name: template.name, trigger_event: template.trigger_event,
    trigger_filters: {}, actions: template.actions, enabled: true,
  });
}

// ── Trigger Evaluation ──

async function executeAction(action: any, workspaceId: string, payload: Record<string, any>): Promise<boolean> {
  switch (action.type) {
    case 'move_task': {
      if (payload.task_id) {
        await supabase.from('tasks').update({ status: action.params.to }).eq('id', payload.task_id);
        return true;
      }
      return false;
    }
    case 'assign_task': {
      if (payload.task_id && action.params.assignee_id) {
        await supabase.from('tasks').update({ assignee_id: action.params.assignee_id }).eq('id', payload.task_id);
        return true;
      }
      return false;
    }
    case 'create_task': {
      const { data } = await supabase.from('tasks').insert({
        workspace_id: workspaceId, project_id: payload.project_id || action.params.project_id,
        name: action.params.name || 'Auto-created task',
        status: action.params.status || 'backlog', estimated_hours: action.params.estimated_hours || 1,
      }).select().single();
      return !!data;
    }
    case 'send_notification': {
      await supabase.from('notifications').insert({
        workspace_id: workspaceId, user_id: payload.assignee_id || action.params.user_id,
        category: 'system', title: action.params.title || 'Automation notification',
        body: action.params.body || '',
      });
      return true;
    }
    case 'create_approval': {
      await supabase.from('approval_instances').insert({
        chain_id: action.params.chain_id, target_type: payload.target_type || 'task',
        target_id: payload.target_id || payload.task_id || '',
        initiated_by: payload.initiated_by,
      });
      return true;
    }
    case 'recalculate_eta': {
      // Trigger ETA recalculation - fire-and-forget
      return true;
    }
    case 'advance_workflow': {
      if (payload.task_id && action.params.to) {
        await supabase.from('tasks').update({ status: action.params.to }).eq('id', payload.task_id);
        return true;
      }
      return false;
    }
    case 'call_webhook': {
      if (action.params.url) {
        fetch(action.params.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: payload.trigger_event, data: payload, timestamp: new Date().toISOString() }),
        }).catch(() => {});
        return true;
      }
      return false;
    }
    case 'create_payroll': {
      return true;
    }
    default:
      return false;
  }
}

const MAX_AUTOMATION_DEPTH = 5;
const processedEvents = new Set<string>();
const EVENT_DEDUP_TTL = 1000;

function dedupKey(event: string, payload: Record<string, any>): string {
  return `${event}_${payload.task_id || payload.doc_id || payload.instance_id || payload.queue_id || ''}_${Date.now()}`;
}

export async function evaluateTriggers(
  event: TriggerEvent, payload: Record<string, any>, depth = 0
): Promise<void> {
  const workspaceId = payload.workspace_id;
  if (!workspaceId || !isSupabaseConfigured || depth >= MAX_AUTOMATION_DEPTH) return;
  try {
    const key = dedupKey(event, payload);
    if (processedEvents.has(key)) return;
    processedEvents.add(key);
    setTimeout(() => processedEvents.delete(key), EVENT_DEDUP_TTL);
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('trigger_event', event)
      .eq('enabled', true);
    if (!rules || rules.length === 0) return;
    activityLogService.logTriggerEvaluated(workspaceId, event, rules.length, depth).catch(() => {});
    for (const rule of rules) {
      await enqueueSync(workspaceId, `automation_${rule.id}`, {
        rule_id: rule.id, event, payload, _depth: depth + 1,
      });
    }
  } catch { /* ignore */ }
}

export function getMaxAutomationDepth(): number {
  return MAX_AUTOMATION_DEPTH;
}

// Called by queue worker
export async function executeAutomationRule(
  workspaceId: string, ruleId: string, event: string, payload: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const { data: rule } = await supabase.from('automation_rules').select('*').eq('id', ruleId).maybeSingle();
    if (!rule) return { success: false, message: 'Rule not found' };
    for (const action of rule.actions) {
      await executeAction(action, workspaceId, { ...payload, trigger_event: event });
    }
    await supabase.from('automation_rules').update({
      last_executed_at: new Date().toISOString(),
      execution_count: (rule.execution_count || 0) + 1,
    }).eq('id', ruleId);
    await activityLogService.appendLog({
      workspace_id: workspaceId, action: 'automation_executed',
      metadata: { rule_id: ruleId, rule_name: rule.name, event, payload_keys: Object.keys(payload) },
    });
    fireEventWebhooks('automation_executed', workspaceId, {
      rule_id: ruleId, rule_name: rule.name, event, payload_keys: Object.keys(payload),
    }).catch(() => {});
    return { success: true, message: `Executed ${rule.name}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export const BUILTIN_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tmpl-pr-merged', name: 'PR merged → move task done', category: 'Development',
    trigger_event: 'integration_sync.completed',
    description: 'When a GitHub PR merge is detected, move the linked task to done',
    actions: [{ type: 'advance_workflow', params: { to: 'done' } }], icon: 'git-merge',
  },
  {
    id: 'tmpl-sprint-complete', name: 'Sprint complete → notify payroll', category: 'Sprints',
    trigger_event: 'sprint.completed',
    description: 'Generate payroll notification when sprint ends',
    actions: [{ type: 'create_payroll', params: {} }, { type: 'send_notification', params: { channel: 'push', title: 'Sprint complete' } }], icon: 'git-fork',
  },
  {
    id: 'tmpl-leave-approved', name: 'Leave approved → recalculate ETA', category: 'Resources',
    trigger_event: 'leave.approved',
    description: 'Recalculate project ETAs when leave is approved',
    actions: [{ type: 'recalculate_eta', params: {} }], icon: 'clock',
  },
  {
    id: 'tmpl-task-blocked', name: 'Task blocked → notify PM', category: 'Tasks',
    trigger_event: 'task.blocked',
    description: 'Alert project managers when a task is blocked',
    actions: [{ type: 'send_notification', params: { title: 'Task blocked', body: 'A task requires attention' } }], icon: 'alert-triangle',
  },
  {
    id: 'tmpl-client-approval', name: 'Client approval → advance workflow', category: 'Approvals',
    trigger_event: 'approval.completed',
    description: 'Auto-advance workflow after client approval',
    actions: [{ type: 'advance_workflow', params: { to: 'review' } }], icon: 'check',
  },
  {
    id: 'tmpl-requirements-approved', name: 'Requirements approved → create sprint', category: 'Sprints',
    trigger_event: 'approval.completed',
    description: 'Auto-create sprint when requirements are approved',
    actions: [{ type: 'create_task', params: { name: 'Sprint planning', estimated_hours: 2 } }, { type: 'send_notification', params: { title: 'Sprint created' } }], icon: 'plus-circle',
  },
];
