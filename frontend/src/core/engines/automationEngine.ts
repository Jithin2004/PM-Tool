import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logServiceFailure } from '../../utils/supabaseError';
import { activityLogService } from '../../services/activityLogService';
import { ActivityEvent } from '../../services/activityEventService';
import { notificationEngine } from './notificationEngine';

export const MAX_EXECUTION_DEPTH = 3;

interface AutomationAction {
  type: string;
  [key: string]: any;
}

// Action Registry
const actionHandlers: Record<string, (action: AutomationAction, payload: any, workspaceId: string) => Promise<boolean>> = {
  send_notification: async (action, payload, workspaceId) => {
    await supabase.from('notifications').insert({
      workspace_id: workspaceId,
      user_id: action.target_user_id || payload.user_id,
      title: action.title || 'Automation Notice',
      body: action.body || 'An automated action was triggered.',
      category: 'system'
    });
    return true;
  },
  create_task: async (action, payload, workspaceId) => {
    await supabase.from('tasks').insert({
      workspace_id: workspaceId,
      project_id: action.project_id || payload.project_id,
      title: action.title || 'Auto Task',
      description: action.description || '',
      status: action.status || 'todo',
      priority: action.priority || 'medium'
    });
    return true;
  },
  change_status: async (action, payload, workspaceId) => {
    if (!payload.entity_id || payload.entity_type !== 'task') return false;
    await supabase.from('tasks').update({ status: action.status }).eq('id', payload.entity_id);
    return true;
  },
  create_approval: async (action, payload, workspaceId) => {
    // Basic wrapper
    return true;
  },
  generate_report: async (action, payload, workspaceId) => {
    // Basic wrapper
    return true;
  },
  create_comment: async (action, payload, workspaceId) => {
    if (!payload.entity_id || !payload.entity_type) return false;
    await supabase.from('comments').insert({
      workspace_id: workspaceId,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      author_id: payload.user_id,
      author_name: 'Automation Bot',
      content: action.content || 'Automated comment'
    });
    return true;
  },
  send_webhook: async (action, payload, workspaceId) => {
    try {
      const { integrationEngine } = await import('./integrationEngine');
      // In this system, webhook could refer to a custom outbound integration setup or direct HTTP 
      // Assuming action.integration_id is provided or custom endpoint
      if (action.integration_id) {
        await integrationEngine.sendOutgoingEvent(workspaceId, action.integration_id, payload.entity_type, payload.entity_id, 'send_webhook', payload);
      }
      return true;
    } catch {
      return false;
    }
  },
  sync_external_entity: async (action, payload, workspaceId) => {
    try {
      const { integrationEngine } = await import('./integrationEngine');
      if (action.integration_id) {
        await integrationEngine.sendOutgoingEvent(workspaceId, action.integration_id, payload.entity_type, payload.entity_id, 'sync_entity', payload);
      }
      return true;
    } catch {
      return false;
    }
  },
  post_external_message: async (action, payload, workspaceId) => {
    try {
      const { integrationEngine } = await import('./integrationEngine');
      if (action.integration_id) {
        // e.g., to Slack
        await integrationEngine.sendOutgoingEvent(workspaceId, action.integration_id, payload.entity_type, payload.entity_id, 'post_message', {
          ...payload,
          message: action.message,
          channel: action.channel
        });
      }
      return true;
    } catch {
      return false;
    }
  }
};

export const automationEngine = {
  async evaluateTrigger(event: ActivityEvent, contextId?: string, depth = 1): Promise<void> {
    if (depth >= MAX_EXECUTION_DEPTH) {
      console.warn(`[AutomationEngine] Max depth reached for event: ${event.id}`);
      return;
    }

    try {
      const { data: rules } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('workspace_id', event.workspace_id)
        .eq('trigger_type', event.action_type)
        .eq('enabled', true);

      if (!rules || rules.length === 0) return;

      const runContextId = contextId || crypto.randomUUID();

      for (const rule of rules) {
        if (this.evaluateConditions(rule.conditions, event)) {
          await this.runAutomation(rule, event, runContextId, depth);
        }
      }
    } catch (err) {
      console.error('[AutomationEngine] Error evaluating trigger:', err);
    }
  },

  evaluateConditions(conditions: Record<string, any>, payload: any): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;
    
    // Very simple matcher
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = payload.metadata?.[key] || payload[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  },

  async runAutomation(rule: any, triggerPayload: any, contextId: string, depth: number): Promise<void> {
    const runId = crypto.randomUUID();
    const actions = rule.actions || rule.action_payload || [];
    
    let status = 'success';
    const executionResult: Record<string, any> = { results: [] };

    if (depth >= MAX_EXECUTION_DEPTH) {
       await this.logRun(runId, rule, triggerPayload, 'failed', { error: 'MAX_DEPTH_REACHED' }, contextId, depth);
       return;
    }

    try {
      for (const action of actions) {
        const handler = actionHandlers[action.type];
        if (handler) {
          const success = await handler(action, triggerPayload, rule.workspace_id);
          executionResult.results.push({ type: action.type, success });
          if (!success) status = 'failed';
        } else {
          executionResult.results.push({ type: action.type, success: false, error: 'Unknown action type' });
          status = 'failed';
        }
      }
    } catch (err: any) {
      status = 'failed';
      executionResult.error = err.message;
    }

    await this.logRun(runId, rule, triggerPayload, status, executionResult, contextId, depth);
  },

  async logRun(runId: string, rule: any, payload: any, status: string, result: any, contextId: string, depth: number) {
    await supabase.from('automation_runs').insert({
      id: runId,
      rule_id: rule.id,
      workspace_id: rule.workspace_id,
      trigger_payload: payload,
      status,
      execution_result: result,
      automation_context_id: contextId,
      execution_depth: depth
    });
  },

  // --- LifecycleAwareService implementation ---
  _status: 'idle' as 'idle' | 'running' | 'paused' | 'error',
  
  initialize(context: any) {
    this._status = 'running';
  },
  
  pause() {
    this._status = 'paused';
  },
  
  resume() {
    this._status = 'running';
  },
  
  dispose() {
    this._status = 'idle';
  },
  
  getStatus() {
    return this._status;
  }
};

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



export async function fetchTemplates(): Promise<AutomationTemplate[]> {
  if (!isSupabaseConfigured) return BUILTIN_TEMPLATES;
  try {
    const { data } = await supabase.from('automation_templates').select('*').limit(50).order('category');
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




export async function fetchAutomationRules(workspaceId: string): Promise<AutomationRule[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('automation_rules')
      .select('*').limit(50)
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
        workspace_id: rule.workspace_id!, action_type: 'automation_created',
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

export async function evaluateTriggers(
  arg1: string,
  arg2: any,
  arg3?: string,
  arg4?: any
): Promise<{ success: boolean; message: string }> {
  let eventName = arg1;
  let payload = arg2;

  if (arg3 && typeof arg3 === 'string') {
    eventName = arg3;
    payload = arg4 || {};
    payload.workspace_id = arg1;
  }

  try {
    await automationEngine.evaluateTrigger({
      id: crypto.randomUUID(),
      workspace_id: payload.workspace_id || payload.workspaceId || '',
      actor_id: 'system',
      entity_type: 'automation',
      entity_id: 'system',
      action_type: eventName,
      metadata: payload,
      created_at: new Date().toISOString()
    } as any);
    return { success: true, message: 'Triggers evaluated' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error' };
  }
}
export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('automation_rules').update({ enabled: false }).eq('id', ruleId);
    return true;
  } catch { return false; }
}

