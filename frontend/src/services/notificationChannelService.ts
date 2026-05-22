export interface NotificationChannel {
  id: string;
  workspace_id: string;
  channel: 'email' | 'push' | 'in_app';
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
}

export interface MentionRule {
  id: string;
  workspace_id: string;
  keyword: string;
  notify_roles: string[];
  notify_users: string[];
  channel: string;
}

export interface EscalationPolicy {
  id: string;
  workspace_id: string;
  name: string;
  trigger_condition: string;
  steps: EscalationStep[];
  enabled: boolean;
}

export interface EscalationStep {
  after_minutes: number;
  notify: string[];
  channel: string;
}

// ---- Stubs ----

export async function fetchChannels(workspaceId: string): Promise<NotificationChannel[]> {
  return [];
}

export async function saveChannelConfig(channel: string, workspaceId: string, config: Record<string, any>): Promise<boolean> {
  return false;
}

export async function fetchMentionRules(workspaceId: string): Promise<MentionRule[]> {
  return [];
}

export async function createMentionRule(rule: Partial<MentionRule>): Promise<MentionRule | null> {
  return null;
}

export async function fetchEscalationPolicies(workspaceId: string): Promise<EscalationPolicy[]> {
  return [];
}

export async function sendEmailNotification(to: string[], subject: string, body: string): Promise<boolean> {
  return false;
}

export async function sendPushNotification(userIds: string[], title: string, body: string): Promise<boolean> {
  return false;
}
