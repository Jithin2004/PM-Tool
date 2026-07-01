import { supabase } from '../../lib/supabase';
import { activityEventService } from '../../services/activityEventService';
import { githubAdapter } from '../../integrations/providers/githubAdapter';
import { slackAdapter } from '../../integrations/providers/slackAdapter';
import { calendarAdapter } from '../../integrations/providers/calendarAdapter';
import { webhookAdapter } from '../../integrations/providers/webhookAdapter';
import { WebhookPayload } from '../../integrations/providers/BaseIntegrationAdapter';
import { isSupabaseConfigured } from '../../lib/supabase';
import { logServiceFailure } from '../../utils/supabaseError';
import { calendarEventService } from '../../services/calendarEventService';
import { activityLogService } from '../../services/activityLogService';


export const getAdapter = (provider: string) => {
  switch (provider) {
    case 'github': return githubAdapter;
    case 'slack': return slackAdapter;
    case 'google_calendar': return calendarAdapter;
    case 'custom_webhook': return webhookAdapter;
    default: return null;
  }
};

export const integrationEngine = {
  /**
   * Register a new integration connection
   */
  async registerIntegration(workspaceId: string, provider: string, credentials: any, userId?: string) {
    const adapter = getAdapter(provider);
    if (!adapter) throw new Error(`No adapter for ${provider}`);

    const connectionResult = await adapter.connect(workspaceId, credentials);
    if (!connectionResult.success) {
      throw new Error(connectionResult.error);
    }

    const { data, error } = await supabase.from('integration_connections').insert({
      workspace_id: workspaceId,
      provider,
      status: 'connected',
      connected_by: userId,
      encrypted_credentials: {
        provider,
        encrypted_payload: '***', // In a real app, encrypt this using KMS
        key_reference: 'default',
        expires_at: credentials.expires_at
      },
      settings: credentials.settings || {}
    }).select().single();

    if (error) throw error;
    
    // Create activity event
    if (userId) {
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: userId,
        entity_type: 'integration',
        entity_id: data.id,
        action_type: 'integration_connected',
        metadata: { provider }
      });
    }

    return data;
  },

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(workspaceId: string, integrationId: string) {
    const { data: conn } = await supabase.from('integration_connections').select('provider').eq('id', integrationId).single();
    if (!conn) return false;

    const adapter = getAdapter(conn.provider);
    if (adapter) {
      await adapter.disconnect(workspaceId, integrationId);
    }

    await supabase.from('integration_connections').update({ status: 'disabled' }).eq('id', integrationId);

    import('./notificationEngine').then(mod => {
      mod.notificationEngine.notifyOwners(workspaceId, 'Integration Disconnected', `${conn.provider} has been disconnected.`);
    });

    return true;
  },

  /**
   * Process an incoming event from an external provider
   */
  async processIncomingEvent(workspaceId: string, integrationId: string, provider: string, payload: WebhookPayload) {
    const adapter = getAdapter(provider);
    if (!adapter) return;

    // 1. Log immutable event to ledger
    const { data: eventRecord } = await supabase.from('integration_events').insert({
      workspace_id: workspaceId,
      integration_id: integrationId,
      direction: 'incoming',
      event_type: 'unknown_pending',
      payload: payload.body || {},
      processing_status: 'processing'
    }).select().single();

    if (!eventRecord) return;

    try {
      // 2. Provider normalization
      const result = await adapter.handleWebhook(workspaceId, integrationId, payload);
      if (!result.success) {
        if ('error' in result) {
          throw new Error(result.error as string);
        } else {
          throw new Error('Sync failed');
        }
      }

      // Update event record with normalized type
      await supabase.from('integration_events').update({
        event_type: result.eventType,
        processing_status: 'success'
      }).eq('id', eventRecord.id);

      // 3. Convert to Resolve PM activity event
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: undefined, // System
        entity_type: 'integration_inbound',
        entity_id: eventRecord.id,
        action_type: result.eventType || 'external_event',
        metadata: result.normalizedPayload
      });

    } catch (e: any) {
      // Failed processing
      await supabase.from('integration_events').update({
        processing_status: 'failed',
        error_message: e.message
      }).eq('id', eventRecord.id);

      import('./notificationEngine').then(mod => {
        mod.notificationEngine.notifyOwners(workspaceId, 'Integration Sync Failed', `Incoming event from ${provider} failed: ${e.message}`);
      });
    }
  },

  /**
   * Send an outgoing event to an external provider
   */
  async sendOutgoingEvent(workspaceId: string, integrationId: string, entityType: string, entityId: string, actionType: string, payload: any) {
    const { data: conn } = await supabase.from('integration_connections').select('*').eq('id', integrationId).single();
    if (!conn || conn.status !== 'connected') return;

    const adapter = getAdapter(conn.provider);
    if (!adapter) return;

    // 1. Log immutable outgoing event
    const { data: eventRecord } = await supabase.from('integration_events').insert({
      workspace_id: workspaceId,
      integration_id: integrationId,
      direction: 'outgoing',
      event_type: `${entityType}.${actionType}`,
      payload: payload,
      processing_status: 'processing'
    }).select().single();

    if (!eventRecord) return;

    try {
      // 2. Transform outbound payload
      const outboundPayload = adapter.transformOutbound(payload);

      // 3. Sync
      const result = await adapter.sync({
        workspaceId,
        integrationId,
        payload: outboundPayload
      });

      if (!result.success) {
        if ('error' in result) {
          throw new Error(result.error as string);
        } else {
          throw new Error('Sync failed');
        }
      }

      // Update processing status
      await supabase.from('integration_events').update({
        processing_status: 'success'
      }).eq('id', eventRecord.id);

      await supabase.from('integration_connections').update({
        last_sync_at: new Date().toISOString()
      }).eq('id', integrationId);

    } catch (e: any) {
      await supabase.from('integration_events').update({
        processing_status: 'failed',
        error_message: e.message
      }).eq('id', eventRecord.id);

      import('./notificationEngine').then(mod => {
        mod.notificationEngine.notifyOwners(workspaceId, 'Integration Sync Failed', `Outgoing event to ${conn.provider} failed: ${e.message}`);
      });
    }
  },

  async retryFailedSync(workspaceId: string, eventId: string) {
    const { data: event } = await supabase.from('integration_events').select('*').eq('id', eventId).single();
    if (!event || event.processing_status !== 'failed') return;

    // Allowed: update processing status
    await supabase.from('integration_events').update({ processing_status: 'retrying' }).eq('id', eventId);

    // Call processing logic based on direction
    if (event.direction === 'incoming') {
      const { data: conn } = await supabase.from('integration_connections').select('provider').eq('id', event.integration_id).single();
      if (!conn) return;
      
      const pseudoWebhookPayload: WebhookPayload = {
        headers: {}, // Replay missing headers (if stored somewhere, ideally)
        body: event.payload,
        method: 'POST'
      };
      await this.processIncomingEvent(workspaceId, event.integration_id, conn.provider, pseudoWebhookPayload);
    } else {
      // For outgoing we would re-send using sendOutgoingEvent or inline logic
      // Simplification for Phase 5F
      await supabase.from('integration_events').update({ processing_status: 'failed', error_message: 'Retry failed (placeholder)' }).eq('id', eventId);
    }
  }
};


const SYNC_COOLDOWN_MS = 30000;
const QUEUE_MAX_CONCURRENT = 2;
const QUEUE_RETRY_BACKOFFS = [2000, 5000, 15000];

// ── Types ──

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
  last_sync_attempt?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  itemsSynced?: number;
}

export type HealthTrend = 'healthy' | 'degrading' | 'critical';
export type QueueState = 'queued' | 'processing' | 'success' | 'failed' | 'retrying';

export interface QueueItem {
  id: string;
  workspaceId: string;
  service: string;
  state: QueueState;
  attempt: number;
  error?: string;
  createdAt: number;
  fn: () => Promise<SyncResult>;
  resolve: (r: SyncResult) => void;
}

export interface SyncJob {
  id: string;
  workspace_id: string;
  service: string;
  payload: Record<string, any>;
  status: 'queued' | 'processing' | 'retrying' | 'success' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  next_retry_at?: string;
  last_error?: string;
  created_by?: string;
}

// ── Sync Queue (DB-backed) ──

const STUCK_TIMEOUT_MS = 5 * 60 * 1000;

const inMemoryQueue: QueueItem[] = [];
let activeCount = 0;

function resolveSyncFn(service: string, payload: Record<string, any>, _workspaceId: string, _accessToken?: string): () => Promise<SyncResult> {
  if (service.startsWith('automation_')) {
    return async () => {
      const mod = await import('./automationEngine');
      const result = await mod.evaluateTriggers(_workspaceId, payload.rule_id, payload.event, payload.payload || payload);
      return { success: result.success, message: result.message, itemsSynced: result.success ? 1 : 0 };
    };
  }
  switch (service) {
    case 'github': return () => syncGitHubRepo(_workspaceId, (payload as any).repo_url || '', (payload as any).branch || 'main');
    case 'gitlab': return () => syncGitLabRepo(_workspaceId, (payload as any).repo_url || '', (payload as any).branch || 'main');
    case 'figma': return () => syncFigmaFrame(_workspaceId, (payload as any).frame_url || '');
    default: return async () => ({ success: false, message: 'Unknown service' });
  }
}

async function updateJobStatus(jobId: string, status: string, extra: Record<string, any> = {}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('integration_sync_jobs').update({ status, ...extra }).eq('id', jobId);
  } catch { /* ignore */ }
}

async function processQueue(): Promise<void> {
  while (activeCount < QUEUE_MAX_CONCURRENT) {
    const item = inMemoryQueue.find(q => q.state === 'queued');
    if (!item) break;
    item.state = 'processing';
    activeCount++;
    await updateJobStatus(item.id, 'processing', { started_at: new Date().toISOString() });
    if (process.env.NODE_ENV === 'development') {
    }
    item.fn().then(result => {
      if (result.success) {
        item.state = 'success';
        updateJobStatus(item.id, 'success', { completed_at: new Date().toISOString() }).catch(() => {});
        activityLogService.logJobCompleted(item.workspaceId, item.id, item.service, result.itemsSynced).catch(() => {});
        import('./automationEngine').then(mod => {
          mod.evaluateTriggers('integration_sync.completed', {
            workspace_id: item.workspaceId, queue_id: item.id, service: item.service, items_synced: result.itemsSynced,
          }).catch(() => {});
        }).catch(() => {});
      } else {
        item.attempt++;
        if (item.attempt <= QUEUE_RETRY_BACKOFFS.length) {
          item.state = 'retrying';
          const backoff = QUEUE_RETRY_BACKOFFS[item.attempt - 1];
          const nextRetry = new Date(Date.now() + backoff).toISOString();
          updateJobStatus(item.id, 'retrying', { attempts: item.attempt, next_retry_at: nextRetry, last_error: result.message }).catch(() => {});
          if (process.env.NODE_ENV === 'development') {
          }
          setTimeout(() => {
            item.state = 'queued';
            activeCount--;
            updateJobStatus(item.id, 'queued').catch(() => {});
            processQueue();
          }, backoff);
          return;
        }
        item.state = 'failed';
        item.error = result.message;
        updateJobStatus(item.id, 'failed', { completed_at: new Date().toISOString(), last_error: result.message, attempts: item.attempt }).catch(() => {});
        activityLogService.logJobFailed(item.workspaceId, item.id, item.service, result.message, item.attempt).catch(() => {});
      }
      activeCount--;
      item.resolve(result);
      processQueue();
    }).catch(e => {
      item.state = 'failed';
      item.error = e.message;
      activeCount--;
      updateJobStatus(item.id, 'failed', { completed_at: new Date().toISOString(), last_error: e.message, attempts: item.attempt }).catch(() => {});
      item.resolve({ success: false, message: e.message });
      processQueue();
    });
  }
}

export async function enqueueSync(
  workspaceId: string, service: string, payload: Record<string, any> = {},
  _accessToken?: string
): Promise<SyncResult> {
  return new Promise(async resolve => {
    if (!isSupabaseConfigured) {
      const fallback = resolveSyncFn(service, payload, workspaceId, _accessToken);
      const result = await fallback();
      resolve(result);
      return;
    }
    try {
      const { data: job } = await supabase.from('integration_sync_jobs').insert({
        workspace_id: workspaceId, service, payload, status: 'queued',
      }).select('id').single();
      const id = job?.id || `fallback_${Date.now()}`;
      const fn = resolveSyncFn(service, payload, workspaceId, _accessToken);
      inMemoryQueue.push({ id, workspaceId, service, state: 'queued', attempt: 0, createdAt: Date.now(), fn, resolve });
      activityLogService.logJobCreated(workspaceId, id, service).catch(() => {});
      if (process.env.NODE_ENV === 'development') {
      }
      processQueue();
    } catch {
      const fn = resolveSyncFn(service, payload, workspaceId, _accessToken);
      const result = await fn();
      resolve(result);
    }
  });
}

export async function recoverJobs(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const cutoff = new Date(Date.now() - STUCK_TIMEOUT_MS).toISOString();
    // Recover stuck processing jobs
    await supabase.from('integration_sync_jobs')
      .update({ status: 'queued', started_at: null })
      .eq('status', 'processing')
      .lt('started_at', cutoff);
    // Load recoverable jobs
    const { data: jobs } = await supabase
      .from('integration_sync_jobs')
      .select('*')
      .in('status', ['queued', 'retrying'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(10);
    if (!jobs || jobs.length === 0) return 0;
    let recovered = 0;
    for (const job of jobs) {
      const fn = resolveSyncFn(job.service, job.payload, job.workspace_id);
      inMemoryQueue.push({
        id: job.id, workspaceId: job.workspace_id, service: job.service,
        state: 'queued', attempt: job.attempts, createdAt: new Date(job.created_at).getTime(),
        fn,
        resolve: () => {},
      });
      recovered++;
    }
    if (process.env.NODE_ENV === 'development') {
    }
    processQueue();
    return recovered;
  } catch { return 0; }
}

let queueStatsFailures = 0;
let queueStatsCooldownUntil = 0;
const QUEUE_STATS_MAX_FAILURES = 3;
const QUEUE_STATS_COOLDOWN_MS = 60000;

export async function getQueueStats(): Promise<{ length: number; pending: number; active: number; failed: number; items: { id: string; service: string; state: QueueState; attempt: number }[] }> {
  const memItems = inMemoryQueue.map(q => ({ id: q.id, service: q.service, state: q.state as QueueState, attempt: q.attempt }));
  const fallback = () => ({ length: inMemoryQueue.length, pending: memItems.filter(i => i.state === 'queued' || i.state === 'retrying').length, active: activeCount, failed: memItems.filter(i => i.state === 'failed').length, items: memItems });
  if (Date.now() < queueStatsCooldownUntil) return fallback();
  if (!isSupabaseConfigured) return fallback();
  try {
    const { count: dbPending, error: pendingError } = await supabase
      .from('integration_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.queued,status.eq.retrying');
    const { count: dbFailed, error: failedError } = await supabase
      .from('integration_sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');
    if (pendingError || failedError) throw new Error(pendingError?.message || failedError?.message);
    queueStatsFailures = 0;
    return { length: (dbPending || 0) + (dbFailed || 0), pending: (dbPending || 0) + memItems.filter(i => i.state === 'queued').length, active: activeCount, failed: (dbFailed || 0), items: memItems };
  } catch {
    queueStatsFailures++;
    if (queueStatsFailures >= QUEUE_STATS_MAX_FAILURES) {
      queueStatsCooldownUntil = Date.now() + QUEUE_STATS_COOLDOWN_MS;
      queueStatsFailures = 0;
    }
    return fallback();
  }
}

// ── Cooldown / Rate Limiting ──

export function getCooldownRemaining(health: IntegrationHealth | undefined): number {
  if (!health?.last_sync_attempt) return 0;
  const elapsed = Date.now() - new Date(health.last_sync_attempt).getTime();
  return Math.max(0, SYNC_COOLDOWN_MS - elapsed);
}

export function formatCooldown(ms: number): string {
  if (ms <= 0) return '';
  const secs = Math.ceil(ms / 1000);
  return `Retry in ${secs}s`;
}

// ── Health Trend ──

export function getHealthTrend(retryCount: number): { trend: HealthTrend; label: string; color: string } {
  if (retryCount >= 5) return { trend: 'critical', label: 'Critical', color: 'text-red-400' };
  if (retryCount >= 2) return { trend: 'degrading', label: 'Degrading', color: 'text-amber-400' };
  return { trend: 'healthy', label: 'Healthy', color: 'text-emerald-400' };
}

// ── OAuth State ──

export async function createOAuthState(workspaceId: string, provider: string, createdBy?: string): Promise<string | null> {
  if (!isSupabaseConfigured || !workspaceId) return null;
  try {
    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('oauth_sessions').insert({
      workspace_id: workspaceId, provider, state_token: stateToken,
      expires_at: expiresAt, created_by: createdBy,
    });
    return stateToken;
  } catch { return null; }
}

export async function verifyOAuthState(stateToken: string, workspaceId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase
      .from('oauth_sessions')
      .select('*')
      .eq('state_token', stateToken)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!data) return false;
    if (data.used) return false;
    if (new Date(data.expires_at) < new Date()) return false;
    await supabase.from('oauth_sessions').update({ used: true }).eq('id', data.id);
    return true;
  } catch { return false; }
}

// ── Connected Accounts ──

export async function fetchConnectedAccounts(workspaceId: string): Promise<ConnectedAccount[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('connected_at', { ascending: false });
    if (data) return data as ConnectedAccount[];
  } catch { /* ignore */ }
  return [];
}

export async function saveConnectedAccount(account: Partial<ConnectedAccount>): Promise<ConnectedAccount | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('connected_accounts')
      .upsert(account, { onConflict: 'workspace_id,service' })
      .select()
      .single();
    if (data) {
      await activityLogService.appendLog({
        workspace_id: account.workspace_id!, actor_id: account.user_id,
        action_type: 'integration_connected',
        metadata: { service: account.service, account_id: data.id },
      });
      return data as ConnectedAccount;
    }
  } catch { /* ignore */ }
  return null;
}

export async function disconnectService(accountId: string, workspaceId?: string, service?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('connected_accounts').delete().eq('id', accountId);
    if (workspaceId && service) {
      await updateIntegrationHealth(workspaceId, service, 'disconnected', 'Disconnected by user');
      await activityLogService.appendLog({
        workspace_id: workspaceId, action_type: 'integration_disconnected',
        metadata: { account_id: accountId, service },
      });
    }
    return true;
  } catch { return false; }
}

// ── Integration Configs ──

export async function fetchIntegrationConfigs(workspaceId: string, projectId?: string): Promise<IntegrationConfig[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    let query = supabase
      .from('integration_configs')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (projectId) query = query.eq('project_id', projectId);
    const { data } = await query;
    if (data) return data as IntegrationConfig[];
  } catch { /* ignore */ }
  return [];
}

export async function saveIntegrationConfig(config: Partial<IntegrationConfig>): Promise<IntegrationConfig | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('integration_configs')
      .upsert(config, { onConflict: 'id' })
      .select()
      .single();
    if (data) return data as IntegrationConfig;
  } catch { /* ignore */ }
  return null;
}

export async function updateIntegrationConfig(configId: string, updates: Partial<IntegrationConfig>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('integration_configs').update(updates).eq('id', configId);
    return true;
  } catch { return false; }
}

// ── Integration Health ──

export async function fetchIntegrationHealth(workspaceId: string): Promise<IntegrationHealth[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    const { data } = await supabase
      .from('integration_health')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('provider', { ascending: true });
    if (data) return data as IntegrationHealth[];
  } catch { /* ignore */ }
  return [];
}

export async function updateIntegrationHealth(
  workspaceId: string, service: string, status: IntegrationHealth['status'], error?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !workspaceId) return false;
  const now = new Date().toISOString();
  try {
    const existing = await supabase
      .from('integration_health')
      .select('id, retry_count')
      .eq('workspace_id', workspaceId)
      .eq('provider', service)
      .maybeSingle();
    if (existing && existing.data) {
      const retry_count = status === 'failed' ? (existing.data.retry_count ?? 0) + 1 : 0;
      await supabase.from('integration_health').update({
        status, 
        last_error: error,
        last_checked_at: now,
        updated_at: now,
        retry_count,
      }).eq('id', existing.data.id);
    } else {
      await supabase.from('integration_health').insert({
        workspace_id: workspaceId, 
        provider: service, 
        status, 
        last_error: error,
        last_checked_at: now,
        created_at: now,
        updated_at: now
      });
    }
    activityLogService.appendLog({
      workspace_id: workspaceId, action_type: 'integration_health_checked',
      metadata: { provider: service, status, error, last_checked_at: now },
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
    default: return { label: 'Disconnected', color: 'text-[var(--pm-text)] dark:text-[var(--text-secondary)]' };
  }
}

export function getConnectionDisplayState(
  healthStatus: string | undefined,
  hasAccount: boolean,
  retryCount?: number
): { label: string; color: string; healthVisible: boolean } {
  // DISCONNECTED overrides all health states
  if (!hasAccount || healthStatus === 'disconnected' || !healthStatus) {
    return { label: 'Disconnected', color: 'text-[var(--pm-text)] dark:text-[var(--text-secondary)]', healthVisible: false };
  }

  // TOKEN_EXPIRED → warning
  if (healthStatus === 'token_expired') {
    return { label: 'Token Expired', color: 'text-amber-400', healthVisible: false };
  }

  // CONNECTED + status determines display
  if (healthStatus === 'connected') {
    return { label: 'Connected', color: 'text-emerald-400', healthVisible: true };
  }
  if (healthStatus === 'syncing') {
    return { label: 'Syncing', color: 'text-cyan-400', healthVisible: false };
  }
  if (healthStatus === 'failed') {
    return { label: 'Failed', color: 'text-red-400', healthVisible: false };
  }

  return { label: 'Disconnected', color: 'text-[var(--pm-text)] dark:text-[var(--text-secondary)]', healthVisible: false };
}

// ── Sync Functions ──

async function syncUpdateHealth(workspaceId: string, service: string, success: boolean, error?: string, itemsSynced?: number): Promise<void> {
  await updateIntegrationHealth(workspaceId, service, success ? 'connected' : 'failed', error);
  if (success) {
    await activityLogService.appendLog({
      workspace_id: workspaceId, action_type: 'integration_sync',
      metadata: { service, items_synced: itemsSynced ?? 0, last_sync: new Date().toISOString() },
    });
  }
}

export async function syncGitHubRepo(workspaceId: string, repoUrl: string, branch: string): Promise<SyncResult> {
  await updateIntegrationHealth(workspaceId, 'github', 'syncing');
  try {
    const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) throw new Error('Invalid GitHub repository URL');
    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const [commitsRes, pullsRes, issuesRes] = await Promise.allSettled([
      fetch(`${apiUrl}/commits?sha=${branch}&per_page=10`),
      fetch(`${apiUrl}/pulls?state=open&per_page=5`),
      fetch(`${apiUrl}/issues?state=open&per_page=5&filter=all`),
    ]);
    const commits = commitsRes.status === 'fulfilled' && commitsRes.value.ok ? await commitsRes.value.json() : [];
    const pulls = pullsRes.status === 'fulfilled' && pullsRes.value.ok ? await pullsRes.value.json() : [];
    const issues = issuesRes.status === 'fulfilled' && issuesRes.value.ok
      ? (await issuesRes.value.json()).filter((i: any) => !i.pull_request) : [];
    await syncUpdateHealth(workspaceId, 'github', true, undefined, commits.length + pulls.length + issues.length);
    return { success: true, message: `Synced ${commits.length} commits, ${pulls.length} PRs, ${issues.length} issues`, itemsSynced: commits.length + pulls.length + issues.length };
  } catch (e: any) {
    await syncUpdateHealth(workspaceId, 'github', false, e.message);
    return { success: false, message: `Sync failed: ${e.message}` };
  }
}

export async function syncGitLabRepo(workspaceId: string, repoUrl: string, branch: string): Promise<SyncResult> {
  await updateIntegrationHealth(workspaceId, 'gitlab', 'syncing');
  try {
    const match = repoUrl.match(/gitlab\.com[:/]([^/]+\/[^/.]+)/);
    if (!match) throw new Error('Invalid GitLab repository URL');
    const encoded = encodeURIComponent(match[1]);
    const apiUrl = `https://gitlab.com/api/v4/projects/${encoded}`;
    const [commitsRes, mergeReqRes] = await Promise.allSettled([
      fetch(`${apiUrl}/repository/commits?ref_name=${branch}&per_page=10`),
      fetch(`${apiUrl}/merge_requests?state=opened&per_page=5`),
    ]);
    const commits = commitsRes.status === 'fulfilled' && commitsRes.value.ok ? await commitsRes.value.json() : [];
    const mergeReqs = mergeReqRes.status === 'fulfilled' && mergeReqRes.value.ok ? await mergeReqRes.value.json() : [];
    await syncUpdateHealth(workspaceId, 'gitlab', true, undefined, commits.length + mergeReqs.length);
    return { success: true, message: `Synced ${commits.length} commits, ${mergeReqs.length} MRs`, itemsSynced: commits.length + mergeReqs.length };
  } catch (e: any) {
    await syncUpdateHealth(workspaceId, 'gitlab', false, e.message);
    return { success: false, message: `Sync failed: ${e.message}` };
  }
}

export async function syncFigmaFrame(workspaceId: string, frameUrl: string): Promise<SyncResult & { frameId?: string; title?: string }> {
  await updateIntegrationHealth(workspaceId, 'figma', 'syncing');
  try {
    const match = frameUrl.match(/figma\.com\/(file|proto)\/([a-zA-Z0-9]+)/);
    if (!match) throw new Error('Invalid Figma frame URL');
    const fileKey = match[2];
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(res.status === 403 ? 'Figma rate limit — retry later' : 'Figma API unavailable');
    const data = await res.json();
    await syncUpdateHealth(workspaceId, 'figma', true, undefined, 1);
    return { success: true, message: 'Frame synced', frameId: fileKey, title: data.name, itemsSynced: 1 };
  } catch (e: any) {
    await syncUpdateHealth(workspaceId, 'figma', false, e.message);
    return { success: false, message: e.message };
  }
}


export async function getRecentActivity(workspaceId: string, service: string, limit = 10): Promise<any[]> {
  return [];
}

// ── // 🚫 Auto-recovery on module load removed in favor of BootstrapOrchestrator 🚫

import { LifecycleAwareService, AppContext } from '../lifecycle/types';

let _integrationStatus: 'idle' | 'running' | 'paused' | 'error' = 'idle';

export const IntegrationService: LifecycleAwareService = {
  initialize: (context: AppContext) => {
    _integrationStatus = 'running';
    if (isSupabaseConfigured) {
      recoverJobs().catch(() => {});
    }
  },
  pause: () => { _integrationStatus = 'paused'; },
  resume: () => { _integrationStatus = 'running'; },
  dispose: () => { _integrationStatus = 'idle'; },
  getStatus: () => _integrationStatus
};

// ── Synthetic stress test helpers (avoid raw inserts) ──

export async function createConnectedAccount(input: {
  workspace_id: string;
  service: string;
  access_token: string;
  connected?: boolean;
}): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('connected_accounts').insert({
      workspace_id: input.workspace_id,
      service: input.service,
      access_token: input.access_token,
      connected: input.connected ?? true,
    }).select('id').maybeSingle();
    if (error) { logServiceFailure('createConnectedAccount', input, error); return null; }
    return data;
  } catch (err) { logServiceFailure('createConnectedAccount', input, err); return null; }
}

export async function createIntegrationConfig(input: {
  workspace_id: string;
  service: string;
  config: Record<string, any>;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('integration_configs').insert({
      workspace_id: input.workspace_id,
      service: input.service,
      config: input.config,
    });
    if (error) { logServiceFailure('createIntegrationConfig', input, error); return false; }
    return true;
  } catch (err) { logServiceFailure('createIntegrationConfig', input, err); return false; }
}

export async function createIntegrationSyncJob(input: {
  workspace_id: string;
  service: string;
  status?: string;
  payload?: Record<string, any>;
  attempts?: number;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('integration_sync_jobs').insert({
      workspace_id: input.workspace_id,
      service: input.service,
      status: input.status || 'queued',
      payload: input.payload || {},
      attempts: input.attempts ?? 0,
    });
    if (error) { logServiceFailure('createIntegrationSyncJob', input, error); return false; }
    return true;
  } catch (err) { logServiceFailure('createIntegrationSyncJob', input, err); return false; }
}




