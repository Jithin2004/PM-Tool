import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export interface ConnectedAccount {
  id: string;
  workspace_id: string;
  user_id?: string;
  service: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  scopes: string[];
  connected_at: string;
}

export interface IntegrationConfig {
  id: string;
  workspace_id: string;
  project_id?: string;
  service: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface IntegrationHealth {
  id: string;
  workspace_id: string;
  service: string;
  status: 'connected' | 'failed' | 'token_expired' | 'syncing' | 'disconnected';
  last_sync?: string;
  last_error?: string;
  latency_ms?: number;
  retry_count: number;
  checked_at: string;
  integration_last_checked?: string;
}

// ---- Stubs ----

export async function fetchConnectedAccounts(workspaceId: string): Promise<ConnectedAccount[]> {
  return [];
}

export async function fetchIntegrationConfigs(workspaceId: string, projectId?: string): Promise<IntegrationConfig[]> {
  return [];
}

export async function saveIntegrationConfig(config: Partial<IntegrationConfig>): Promise<IntegrationConfig | null> {
  return null;
}

export async function disconnectService(accountId: string): Promise<boolean> {
  return false;
}

export async function fetchIntegrationHealth(workspaceId: string): Promise<IntegrationHealth[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from('integration_health')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('service', { ascending: true });
    if (data) return data as IntegrationHealth[];
  } catch { /* ignore */ }
  return [];
}

export async function updateIntegrationHealth(
  workspaceId: string,
  service: string,
  status: IntegrationHealth['status'],
  error?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const now = new Date().toISOString();
  try {
    const { data: existing } = await supabase
      .from('integration_health')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('service', service)
      .maybeSingle();
    if (existing) {
      await supabase.from('integration_health').update({
        status,
        last_error: error,
        last_sync: status === 'connected' ? now : undefined,
        checked_at: now,
        integration_last_checked: now,
      }).eq('id', existing.id);
    } else {
      await supabase.from('integration_health').insert({
        workspace_id: workspaceId, service, status,
        last_error: error, checked_at: now, integration_last_checked: now,
      });
    }
    activityLogService.appendLog({
      workspace_id: workspaceId, actor_id: '',
      action: 'integration_health_checked',
      metadata: { workspace_id: workspaceId, service, status, error, integration_last_checked: now },
    });
    return true;
  } catch { return false; }
}

export function getHealthDisplay(status: string): { label: string; color: string } {
  switch (status) {
    case 'connected': return { label: 'Connected', color: 'text-emerald-400' };
    case 'syncing': return { label: 'Syncing', color: 'text-cyan-400' };
    case 'failed': return { label: 'Failed', color: 'text-red-400' };
    case 'token_expired': return { label: 'Token Expired', color: 'text-amber-400' };
    default: return { label: 'Disconnected', color: 'text-white/30' };
  }
}
