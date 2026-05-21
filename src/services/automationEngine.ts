export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  trigger_event: string;
  trigger_filters: Record<string, any>;
  actions: any[];
  enabled: boolean;
  created_at: string;
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
  | 'task.created'
  | 'task.status_changed'
  | 'task.assigned'
  | 'project.created'
  | 'project.status_changed'
  | 'sprint.started'
  | 'sprint.completed'
  | 'approval.completed'
  | 'document.updated'
  | 'comment.added';

// ---- Stubs ----

export async function fetchAutomationRules(workspaceId: string): Promise<AutomationRule[]> {
  return [];
}

export async function createAutomationRule(rule: Partial<AutomationRule>): Promise<AutomationRule | null> {
  return null;
}

export async function toggleAutomationRule(ruleId: string, enabled: boolean): Promise<boolean> {
  return false;
}

export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  return false;
}

export async function fetchTemplates(): Promise<AutomationTemplate[]> {
  return [];
}

export async function evaluateTriggers(event: TriggerEvent, payload: Record<string, any>): Promise<void> {
  // Stub: will match rules, execute actions
}

export const BUILTIN_TEMPLATES: AutomationTemplate[] = [
  { id: 'tmpl-1', name: 'Auto-assign on creation', category: 'Tasks', trigger_event: 'task.created',
    description: 'Automatically assign new tasks based on workload', actions: [{ type: 'assign_team_member', params: {} }], icon: 'zap' },
  { id: 'tmpl-2', name: 'Status transition notification', category: 'Notifications', trigger_event: 'task.status_changed',
    description: 'Notify when tasks move to specific lanes', actions: [{ type: 'send_notification', params: { channel: 'push' } }], icon: 'bell' },
  { id: 'tmpl-3', name: 'Sprint completion summary', category: 'Sprints', trigger_event: 'sprint.completed',
    description: 'Generate summary and notify stakeholders on sprint end', actions: [{ type: 'generate_report', params: {} }, { type: 'send_notification', params: { channel: 'email' } }], icon: 'git-fork' },
  { id: 'tmpl-4', name: 'Escalate stale tasks', category: 'Tasks', trigger_event: 'task.created',
    description: 'Escalate tasks that remain in same status for 3+ days', actions: [{ type: 'escalate', params: { after_hours: 72 } }], icon: 'alert-triangle' },
  { id: 'tmpl-5', name: 'Auto-close on approval', category: 'Approvals', trigger_event: 'approval.completed',
    description: 'Auto-transition task/project after final approval step', actions: [{ type: 'transition_status', params: { to: 'approved' } }], icon: 'check' },
];
