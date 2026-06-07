import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { sha256 } from '../utils/cryptoUtils';
import { logServiceFailure } from '../utils/supabaseError';

const WEBHOOK_RETRY_BACKOFFS = [2000, 5000, 15000];

export interface Webhook {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  last_triggered_at?: string;
  created_at: string;
}

export async function fetchWebhooks(workspaceId: string): Promise<Webhook[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('webhooks')
      .select('*').limit(50)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (data) return data as Webhook[];
  } catch { /* ignore */ }
  return [];
}

export async function createWebhook(webhook: Partial<Webhook>): Promise<Webhook | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.from('webhooks').insert(webhook).select().single();
    if (data) return data as Webhook;
  } catch (err) { logServiceFailure('createWebhook', webhook, err); }
  return null;
}

export async function updateWebhook(id: string, updates: Partial<Webhook>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('webhooks').update(updates).eq('id', id);
    return true;
  } catch { return false; }
}

export async function deleteWebhook(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('webhooks').delete().eq('id', id);
    return true;
  } catch { return false; }
}

export async function fireEventWebhooks(event: string, workspaceId: string, payload: Record<string, any>): Promise<void> {
  if (!isSupabaseConfigured || !workspaceId) return;
  try {
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*').limit(50)
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .contains('events', [event]);
    if (!webhooks || webhooks.length === 0) return;
    for (const wh of webhooks) {
      deliverWebhook(wh, event, payload, 0);
    }
  } catch { /* ignore */ }
}

async function deliverWebhook(wh: Webhook, event: string, payload: Record<string, any>, attempt: number): Promise<void> {
  const body = JSON.stringify({
    event, workspace_id: wh.workspace_id,
    payload, timestamp: new Date().toISOString(),
    attempt: attempt + 1,
  });
  const signature = wh.secret ? await sha256(wh.secret + body) : undefined;
  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Resolve-Event': event,
        'X-Resolve-Signature': signature || '',
        'X-Resolve-Attempt': String(attempt + 1),
      },
      body,
    });
    await supabase.from('webhooks').update({ last_triggered_at: new Date().toISOString() }).eq('id', wh.id);
    await activityLogService.appendLog({
      workspace_id: wh.workspace_id, action: 'webhook_sent',
      metadata: { webhook_id: wh.id, webhook_name: wh.name, event, status_code: res.status, attempt: attempt + 1 },
    });
    if (!res.ok && attempt < WEBHOOK_RETRY_BACKOFFS.length) {
      setTimeout(() => deliverWebhook(wh, event, payload, attempt + 1), WEBHOOK_RETRY_BACKOFFS[attempt]);
    }
  } catch (e: any) {
    if (attempt < WEBHOOK_RETRY_BACKOFFS.length) {
      setTimeout(() => deliverWebhook(wh, event, payload, attempt + 1), WEBHOOK_RETRY_BACKOFFS[attempt]);
    } else {
      await activityLogService.appendLog({
        workspace_id: wh.workspace_id, action: 'webhook_failed',
        metadata: { webhook_id: wh.id, webhook_name: wh.name, event, error: e.message, attempt: attempt + 1 },
      });
    }
  }
}
