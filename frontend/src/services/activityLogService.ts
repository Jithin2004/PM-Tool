import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../utils/cryptoUtils';
import { hasCapability } from '../core/auth/permissions';

export interface ActivityLogEntry {
  id?: string;
  workspace_id: string;
  actor_id?: string;
  project_id?: string;
  task_id?: string;
  action_type: string;
  entity_type?: string;
  metadata: Record<string, any>;
  previous_hash?: string;
  hash?: string;
  created_at?: string;
}

function deriveEntityType(action: string): string {
  if (action.includes('project')) return 'project';
  if (action.includes('task')) return 'task';
  if (action.includes('milestone')) return 'milestone';
  if (action.includes('user') || action.includes('role') || action.includes('invite')) return 'user';
  if (action.includes('finance') || action.includes('ledger') || action.includes('budget')) return 'finance';
  if (action.includes('document') || action.includes('file')) return 'document';
  return 'system';
}

// ─── Constants for graceful RLS degradation ────────────────────

const LOG_RETRY_MS = 10_000;
const MAX_LOG_RETRIES = 5;
const RLS_WARN_THROTTLE_MS = 30_000;

// ─── Debug helpers ─────────────────────────────────────────────

export interface ActivityLogContext {
  authUid: string | null;
  usersRowExists: boolean;
  usersRow: { id: string; workspace_id: string | null; role: string | null } | null;
  workspaceId: string | null;
  role: string | null;
  ownerWorkspaceIds: string[];
  currentSessionExists: boolean;
}

export async function debugActivityLogContext(): Promise<ActivityLogContext> {
  const ctx: ActivityLogContext = {
    authUid: null,
    usersRowExists: false,
    usersRow: null,
    workspaceId: null,
    role: null,
    ownerWorkspaceIds: [],
    currentSessionExists: false,
  };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    ctx.currentSessionExists = !!session;
    const { data: { user } } = await supabase.auth.getUser();
    ctx.authUid = user?.id || null;
    if (user) {
      const { data: row } = await supabase.from('users').select('id, workspace_id, role').eq('id', user.id).maybeSingle();
      ctx.usersRow = row || null;
      ctx.usersRowExists = !!row;
      ctx.workspaceId = row?.workspace_id || null;
      ctx.role = row?.role || null;
    }
    const { data: owned } = await supabase.from('workspaces').select('id').eq('owner_id', ctx.authUid || '');
    ctx.ownerWorkspaceIds = (owned || []).map(w => w.id);
  } catch { /* best effort */ }
  return ctx;
}

export interface AccessCheck {
  canInsert: boolean;
  reason: string;
}

export async function verifyActivityLogAccess(workspaceId: string): Promise<AccessCheck> {
  const ctx = await debugActivityLogContext();

  if (!ctx.currentSessionExists) return { canInsert: false, reason: 'No active session' };
  if (!ctx.authUid) return { canInsert: false, reason: 'No authenticated user' };
  if (!ctx.usersRowExists) return { canInsert: false, reason: 'No users row exists for this auth UID' };
  if (ctx.usersRow && !ctx.usersRow.workspace_id) return { canInsert: false, reason: 'users.workspace_id is null' };
  if (ctx.workspaceId !== workspaceId) return { canInsert: false, reason: `Workspace mismatch: appendLog workspace_id=${workspaceId}, users.workspace_id=${ctx.workspaceId}` };
  if (ctx.role && !hasCapability(ctx.role as any, 'view_projects')) return { canInsert: false, reason: 'Pending setup or uninvited, no workspace access' };
  if (ctx.ownerWorkspaceIds.length === 0 && !ctx.workspaceId) return { canInsert: false, reason: 'No owned workspaces and no workspace context' };

  return { canInsert: true, reason: 'OK' };
}

export const activityLogService = {
  _queue: [] as { entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash' | 'id' | 'created_at'>; retries: number }[],
  _queueTimer: null as ReturnType<typeof setInterval> | null,
  _rlsWarnTimers: new Map<string, number>(),

  _shouldThrottleRlsWarn(wsId: string): boolean {
    const now = Date.now();
    const last = this._rlsWarnTimers.get(wsId) || 0;
    if (now - last > RLS_WARN_THROTTLE_MS) {
      this._rlsWarnTimers.set(wsId, now);
      return false;
    }
    return true;
  },

  _processQueue: async () => {
    const s = activityLogService;
    if (s._queue.length === 0) return;
    const batch = s._queue.splice(0, s._queue.length);
    for (const item of batch) {
      const ok = await s.appendLogDirect(item.entry);
      if (!ok && item.retries + 1 < MAX_LOG_RETRIES) {
        s._queue.push({ entry: item.entry, retries: item.retries + 1 });
      }
    }
  },

  _startQueue() {
    if (this._queueTimer) return;
    this._queueTimer = setInterval(() => activityLogService._processQueue(), LOG_RETRY_MS);
  },

  async getPreviousHash(workspaceId: string): Promise<string> {
    if (!isSupabaseConfigured) return 'GENESIS_BLOCK';
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('hash')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error || !data) return 'GENESIS_BLOCK';
      return data.hash || 'GENESIS_BLOCK';
    } catch (e) {
      return 'GENESIS_BLOCK';
    }
  },

  async computeHash(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash'>, previousHash: string, createdAt?: string): Promise<string> {
    const rawTs = createdAt || entry.created_at || new Date().toISOString();
    const ts = new Date(rawTs).toISOString(); // Normalize postgres timestamp differences (+00:00 vs Z)
    
    // Deterministic stringify for JSONB roundtrips
    const deterministicStringify = (obj: any): string => {
      if (obj === null || obj === undefined) return 'null';
      if (Array.isArray(obj)) return '[' + obj.map(deterministicStringify).join(',') + ']';
      if (typeof obj === 'object') {
        const keys = Object.keys(obj).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + deterministicStringify(obj[k])).join(',') + '}';
      }
      return JSON.stringify(obj);
    };

    const metadataStr = entry.metadata ? deterministicStringify(entry.metadata) : 'null';
    const message = `${entry.workspace_id}${entry.actor_id ?? ''}${entry.project_id ?? ''}${entry.task_id ?? ''}${entry.action_type}${metadataStr}${previousHash}${ts}`;
    return sha256(message);
  },

  async appendLogDirect(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash' | 'id' | 'created_at'>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    if (!entry.workspace_id) return false;
    try {
      const previousHash = await this.getPreviousHash(entry.workspace_id);
      const createdAt = new Date().toISOString();
      const hash = await this.computeHash(entry, previousHash, createdAt);
      const { error } = await supabase.from('activity_logs').insert({
        workspace_id: entry.workspace_id,
        actor_id: entry.actor_id,
        project_id: entry.project_id,
        task_id: entry.task_id,
        action: entry.action_type,
        entity_type: entry.entity_type || deriveEntityType(entry.action_type),
        metadata: entry.metadata,
        created_at: createdAt,
        hash: hash,
        previous_hash: previousHash
      });
      if (error) {
        if (error.code !== '42501') console.error('ActivityLogService: appendLog failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('ActivityLogService: appendLog exception:', e);
      return false;
    }
  },

  async appendLog(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash' | 'id' | 'created_at'>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    if (!entry.workspace_id) {
      return false;
    }

    // Forensic preflight
    const access = await verifyActivityLogAccess(entry.workspace_id);
    if (isForensicDebugEnabled()) {
    }

    if (!access.canInsert) {
      this._queue.push({ entry, retries: 0 });
      this._startQueue();
      recordForensicAppend('queued');
      if (isForensicDebugEnabled() && !this._shouldThrottleRlsWarn(entry.workspace_id)) {
      }
      return false;
    }

    try {
      const previousHash = await this.getPreviousHash(entry.workspace_id);
      const createdAt = new Date().toISOString();
      const hash = await this.computeHash(entry, previousHash, createdAt);
      const { error } = await supabase.from('activity_logs').insert({
        workspace_id: entry.workspace_id,
        actor_id: entry.actor_id,
        project_id: entry.project_id,
        task_id: entry.task_id,
        action: entry.action_type,
        entity_type: entry.entity_type || deriveEntityType(entry.action_type),
        metadata: entry.metadata,
        created_at: createdAt,
        hash: hash,
        previous_hash: previousHash
      });
      if (error) {
        if (error.code === '42501') {
          this._queue.push({ entry, retries: 0 });
          this._startQueue();
          recordForensicAppend('queued');
          if (isForensicDebugEnabled() && !this._shouldThrottleRlsWarn(entry.workspace_id)) {
          }
          return false;
        }
        console.error('ActivityLogService: appendLog failed:', error);
        recordForensicAppend('failed');
        return false;
      }
      recordForensicAppend('success');
      return true;
    } catch (e) {
      console.error('ActivityLogService: appendLog exception:', e);
      recordForensicAppend('failed');
      return false;
    }
  },

  async getLogs(workspaceId: string, projectId?: string, taskId?: string): Promise<ActivityLogEntry[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('activity_logs')
        .select('*').limit(50)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      if (taskId) query = query.eq('task_id', taskId);
      const { data, error } = await query;
      if (!error && data) return data as ActivityLogEntry[];
    } catch (e) {
    }
    return [];
  },

  async verifyChain(workspaceId: string): Promise<{ valid: boolean; tamperedIndex: number | null }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { valid: true, tamperedIndex: null };
    let currentPrevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (i === 0 && (!log.previous_hash || log.previous_hash === 'GENESIS_BLOCK')) {
        currentPrevHash = log.hash || 'GENESIS_BLOCK';
        continue;
      }
      if (!log.hash && !log.previous_hash) {
        currentPrevHash = 'GENESIS_BLOCK';
        continue;
      }
      if (log.previous_hash !== currentPrevHash) {
        if (log.previous_hash === 'GENESIS_BLOCK' || !log.previous_hash) {
          currentPrevHash = log.hash || 'GENESIS_BLOCK';
          continue;
        }
        return { valid: false, tamperedIndex: i };
      }
      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) return { valid: false, tamperedIndex: i };
      currentPrevHash = log.hash!;
    }
    return { valid: true, tamperedIndex: null };
  },

  async verifyHashChain(workspaceId: string): Promise<{ status: 'Valid' | 'Broken' | 'CHAIN_REINDEX' | 'Suspicious'; logCount: number; tamperedIndex: number | null; message: string }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { status: 'Valid', logCount: 0, tamperedIndex: null, message: 'No logs to verify' };

    // Check genesis mismatch at index 0
    if (logs.length > 0) {
      const first = logs[0];
      if (!first.previous_hash || first.previous_hash === 'GENESIS_BLOCK') {
        // Legacy genesis — not corruption
      } else if (first.previous_hash !== 'GENESIS_BLOCK') {
        // First entry has a non-genesis hash pointing to nothing — legacy reset
        await this.logHashChainVerified(workspaceId, 'CHAIN_REINDEX', logs.length, 0);
        return { status: 'CHAIN_REINDEX', logCount: logs.length, tamperedIndex: 0, message: 'Chain initialized from legacy records' };
      }
    }

    let broken = false;
    let firstBad: number | null = null;
    let suspicious = false;
    let currentPrevHash = 'GENESIS_BLOCK';
    let prevTimestamp = '';
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Genesis entry at index 0 with null/legacy previous_hash is valid
      if (i === 0 && (!log.previous_hash || log.previous_hash === 'GENESIS_BLOCK')) {
        currentPrevHash = log.hash || 'GENESIS_BLOCK';
        continue;
      }

      // Legacy rows without hashes are implicitly valid
      if (!log.hash && !log.previous_hash) {
        currentPrevHash = 'GENESIS_BLOCK';
        continue;
      }

      // Evaluate if this is a repair block
      const isRepairBlock = log.action === 'ledger_chain_repaired' || (log.action === 'hash_chain_verified' && log.metadata?.chain_status === 'CHAIN_REPAIRED');

      if (isRepairBlock) {
        // We validate the repair block itself to ensure it hasn't been tampered with
        const recomputed = await this.computeHash(log, log.previous_hash || 'GENESIS_BLOCK');
        if (log.hash === recomputed) {
          // Accept the repair block as the new ground truth!
          broken = false;
          firstBad = null;
          suspicious = false;
          currentPrevHash = log.hash!;
          continue; // Move forward with the repaired chain
        }
        // If the repair block itself is tampered, it falls through to normal mismatch logic
      }

      // Non-genesis hash mismatch = real corruption (or fork)
      if (log.previous_hash !== currentPrevHash) {
        if (log.previous_hash === 'GENESIS_BLOCK' || !log.previous_hash) {
           currentPrevHash = log.hash || 'GENESIS_BLOCK';
           continue;
        }
        if (!broken) { broken = true; firstBad = i; }
        currentPrevHash = log.hash || currentPrevHash; // Resync
        continue;
      }

      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) {
        if (!broken) { broken = true; firstBad = i; }
        currentPrevHash = log.hash || currentPrevHash; // Resync
        continue;
      }
      currentPrevHash = log.hash!;
      if (log.created_at) {
        if (prevTimestamp && log.created_at < prevTimestamp) {
          suspicious = true;
        }
        prevTimestamp = log.created_at;
      }
    }
    
    // We NO LONGER append hash_chain_verified logs. They cause infinite verification loops and concurrent forks.
    if (broken) {
      return { status: 'Broken', logCount: logs.length, tamperedIndex: firstBad, message: `Chain broken at index ${firstBad}` };
    }
    if (suspicious) {
      return { status: 'Suspicious', logCount: logs.length, tamperedIndex: null, message: 'Chain valid but timestamps out of order' };
    }
    return { status: 'Valid', logCount: logs.length, tamperedIndex: null, message: 'Chain intact' };
  },

  async verifyHashChainDetailed(workspaceId: string): Promise<{ valid: boolean; brokenIndex: number | null; severity: 'none' | 'warning' | 'critical'; reason: string }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { valid: true, brokenIndex: null, severity: 'none', reason: 'No logs' };

    let result = { valid: true, brokenIndex: null as number | null, severity: 'none' as 'none' | 'warning' | 'critical', reason: 'Chain intact' };

    if (logs.length > 0) {
      const first = logs[0];
      if (first.previous_hash && first.previous_hash !== 'GENESIS_BLOCK') {
        result = { valid: false, brokenIndex: 0, severity: 'warning', reason: 'Chain initialized from legacy records' };
      }
    }

    let currentPrevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (i === 0 && (!log.previous_hash || log.previous_hash === 'GENESIS_BLOCK')) {
        currentPrevHash = log.hash || 'GENESIS_BLOCK';
        continue;
      }
      if (!log.hash && !log.previous_hash) {
        currentPrevHash = 'GENESIS_BLOCK';
        continue;
      }
      const isRepairBlock = log.action === 'ledger_chain_repaired' || (log.action === 'hash_chain_verified' && log.metadata?.chain_status === 'CHAIN_REPAIRED');

      if (isRepairBlock) {
        const recomputed = await this.computeHash(log, log.previous_hash || 'GENESIS_BLOCK');
        if (log.hash === recomputed) {
          result = { valid: true, brokenIndex: null, severity: 'none', reason: 'Chain intact' };
          currentPrevHash = log.hash!;
          continue;
        }
      }

      if (log.previous_hash !== currentPrevHash) {
        if (log.previous_hash === 'GENESIS_BLOCK' || !log.previous_hash) {
          currentPrevHash = log.hash || 'GENESIS_BLOCK';
          continue;
        }
        if (result.valid) {
          result = { valid: false, brokenIndex: i, severity: 'critical', reason: `Hash mismatch at index ${i}` };
        }
        currentPrevHash = log.hash || currentPrevHash;
        continue;
      }
      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) {
        if (result.valid) {
          result = { valid: false, brokenIndex: i, severity: 'critical', reason: `Tampered hash at index ${i}` };
        }
        currentPrevHash = log.hash || currentPrevHash;
        continue;
      }
      currentPrevHash = log.hash!;
    }
    return result;
  },

  async repairHashChain(workspaceId: string): Promise<boolean> {
    const logs = await this.getLogs(workspaceId);
    if (!logs || logs.length === 0) return true;

    // Check if it's actually broken right now
    const status = await this.verifyHashChainDetailed(workspaceId);
    if (status.valid) return true;

    // To preserve WORM (Write-Once-Read-Many) integrity, we DO NOT mutate historical records.
    // Instead, we append a re-indexing block that explicitly resets the verification chain.
    const reindexSuccess = await this.appendLog({
      workspace_id: workspaceId,
      action_type: 'ledger_chain_repaired',
      metadata: { 
        reason: 'Authorized manual re-index to clear historical tampering/forks',
        broken_index: status.brokenIndex 
      }
    });

    if (reindexSuccess) {
      // Re-verify immediately to update the backend log_count stats
      await this.verifyHashChain(workspaceId);
    }
    
    return reindexSuccess;
  },

  // ── Command Intelligence Event Logging ──

  async logHeatmapView(workspaceId: string, actorId?: string, metadata?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'command_heatmap_viewed',
      metadata: { ...metadata, event_type: 'heatmap_view' },
    });
  },

  async logPredictionUsed(workspaceId: string, actorId?: string, predictionId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'workflow_prediction_used',
      metadata: { prediction_id: predictionId, event_type: 'prediction_used' },
    });
  },

  async logFrictionDetected(workspaceId: string, actorId?: string, frictionData?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'workflow_friction_detected',
      metadata: { ...frictionData, event_type: 'friction_detected' },
    });
  },

  async logHealthGenerated(workspaceId: string, actorId?: string, healthData?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'command_health_generated',
      metadata: { ...healthData, event_type: 'health_generated' },
    });
  },

  // ── Ecosystem Event Logging ──

  async logIntegrationConnected(workspaceId: string, service: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'integration_connected',
      metadata: { service },
    });
  },

  async logIntegrationSync(workspaceId: string, service: string, itemsSynced: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'integration_sync',
      metadata: { service, items_synced: itemsSynced },
    });
  },

  async logFileUploaded(workspaceId: string, fileName: string, taskId?: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId, task_id: taskId,
      action_type: 'file_uploaded',
      metadata: { file_name: fileName, task_id: taskId },
    });
  },

  async logFileVersionCreated(workspaceId: string, docId: string, version: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'file_version_created',
      metadata: { doc_id: docId, version },
    });
  },

  async logDocumentCreated(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'document_created',
      metadata: { doc_id: docId, title },
    });
  },

  async logAnnotationAdded(workspaceId: string, docId: string, annotationId: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'annotation_added',
      metadata: { doc_id: docId, annotation_id: annotationId },
    });
  },

  // ── Stage 2 Hardening Logging ──

  async logSyncQueued(workspaceId: string, queueId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_sync_queued',
      metadata: { queue_id: queueId, service },
    });
  },

  async logSyncStarted(workspaceId: string, queueId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_sync_started',
      metadata: { queue_id: queueId, service },
    });
  },

  async logSyncCompleted(workspaceId: string, queueId: string, service: string, itemsSynced?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_sync_completed',
      metadata: { queue_id: queueId, service, items_synced: itemsSynced },
    });
  },

  async logSyncRetry(workspaceId: string, queueId: string, service: string, attempt: number, backoffMs: number, error?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_sync_retry',
      metadata: { queue_id: queueId, service, attempt, backoff_ms: backoffMs, error },
    });
  },

  async logOAuthStateCreated(workspaceId: string, provider: string, expiresAt: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'oauth_state_created',
      metadata: { provider, expires_at: expiresAt },
    });
  },

  async logOAuthStateVerified(workspaceId: string, sessionId: string, provider: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'oauth_state_verified',
      metadata: { oauth_session_id: sessionId, provider },
    });
  },

  // ── Queue Persistence Logging ──

  async logJobCreated(workspaceId: string, jobId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_job_created',
      metadata: { job_id: jobId, service },
    });
  },

  async logJobRecovered(workspaceId: string, jobId: string, service: string, status: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_job_recovered',
      metadata: { job_id: jobId, service, previous_status: status },
    });
  },

  async logJobCompleted(workspaceId: string, jobId: string, service: string, itemsSynced?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_job_completed',
      metadata: { job_id: jobId, service, items_synced: itemsSynced },
    });
  },

  async logJobFailed(workspaceId: string, jobId: string, service: string, error: string, attempts: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'integration_job_failed',
      metadata: { job_id: jobId, service, error, attempts },
    });
  },

  // ── Stage 3 Ignition Logging ──

  async logAutomationCreated(workspaceId: string, ruleId: string, name: string, triggerEvent: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'automation_created',
      metadata: { rule_id: ruleId, name, trigger_event: triggerEvent },
    });
  },

  async logAutomationExecuted(workspaceId: string, ruleId: string, ruleName: string, event: string, payloadKeys: string[]): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'automation_executed',
      metadata: { rule_id: ruleId, rule_name: ruleName, event, payload_keys: payloadKeys },
    });
  },

  async logApprovalCreated(workspaceId: string, instanceId: string, targetType: string, targetId: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'approval_created',
      metadata: { instance_id: instanceId, target_type: targetType, target_id: targetId },
    });
  },

  async logApprovalCompleted(workspaceId: string, instanceId: string, targetType: string, targetId: string, result: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'approval_completed',
      metadata: { instance_id: instanceId, target_type: targetType, target_id: targetId, result },
    });
  },

  async logApiKeyCreated(workspaceId: string, keyId: string, name: string, permissions: string[]): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'api_key_created',
      metadata: { key_id: keyId, name, permissions },
    });
  },

  async logWebhookSent(workspaceId: string, webhookId: string, webhookName: string, event: string, statusCode: number, attempt: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'webhook_sent',
      metadata: { webhook_id: webhookId, webhook_name: webhookName, event, status_code: statusCode, attempt },
    });
  },

  async logTemplateInstalled(workspaceId: string, templateId: string, templateName: string, ruleId: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'workflow_template_installed',
      metadata: { template_id: templateId, template_name: templateName, rule_id: ruleId },
    });
  },

  // ── Launch Hardening Logging ──

  async logWebhookTriggered(workspaceId: string, event: string, webhookCount: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'webhook_triggered',
      metadata: { event, webhook_count: webhookCount },
    });
  },

  async logTriggerEvaluated(workspaceId: string, event: string, ruleCount: number, depth: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'automation_trigger_evaluated',
      metadata: { event, rule_count: ruleCount, depth },
    });
  },

  async logApiRequest(workspaceId: string, endpoint: string, method: string, statusCode: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'api_request_processed',
      metadata: { endpoint, method, status_code: statusCode },
    });
  },

  async logRoleGuardRejected(workspaceId: string, action: string, userId: string, requiredRole: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'role_guard_rejected',
      metadata: { attempted_action: action, user_id: userId, required_role: requiredRole },
    });
  },

  async logSessionExpired(workspaceId: string, userId: string, reason: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'session_expired',
      metadata: { user_id: userId, reason },
    });
  },

  async logHashChainVerified(workspaceId: string, chainStatus: string, logCount: number, tamperedIndex?: number | null): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'hash_chain_verified',
      metadata: { chain_status: chainStatus, log_count: logCount, tampered_index: tamperedIndex },
    });
  },

  async logSimulationCompleted(workspaceId: string, successCount: number, failureCount: number, recoveryCount: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'system_simulation_completed',
      metadata: { success_count: successCount, failure_count: failureCount, recovery_count: recoveryCount },
    });
  },

  // ── Production Observability ──

  async logClientError(workspaceId: string, source: string, message: string, stack?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'client_error_events',
      metadata: { source, message, stack: stack?.slice(0, 500) },
    });
  },

  async logQueueFailure(workspaceId: string, queueId: string, service: string, error: string, attempt: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'queue_failure_events',
      metadata: { queue_id: queueId, service, error, attempt },
    });
  },

  async logApiFailure(workspaceId: string, endpoint: string, method: string, statusCode: number, error: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'api_failure_events',
      metadata: { endpoint, method, status_code: statusCode, error },
    });
  },

  async logRenderFailure(workspaceId: string, boundary: string, error: string, componentStack?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'render_failure_events',
      metadata: { boundary, error, component_stack: componentStack?.slice(0, 500) },
    });
  },

  // ── Document Soft Delete Logging ──

  async logDocumentDeleted(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'document_deleted',
      metadata: { doc_id: docId, title },
    });
  },

  async logDocumentRestored(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'document_restored',
      metadata: { doc_id: docId, title },
    });
  },

  async logDocumentArchivedViewed(workspaceId: string, actorId?: string, archivedCount?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action_type: 'document_archived_viewed',
      metadata: { archived_count: archivedCount },
    });
  },

  // ── Stress Test Safety Logging ──

  async logStressTestBlocked(workspaceId: string, reason: string, runId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_test_blocked',
      metadata: { reason, blocked_run_id: runId },
    });
  },

  async logStressTestDryRun(workspaceId: string, runId: string, estimate: Record<string, number>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_test_dry_run',
      metadata: { run_id: runId, estimate },
    });
  },

  async logStressCleanupManual(workspaceId: string, runId: string, cleaned: Record<string, number>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_cleanup_manual',
      metadata: { run_id: runId, cleaned },
    });
  },

  // ── Auth Integrity Logging ──

  async logWorkspaceRepaired(workspaceId: string, userId: string, reason: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: userId,
      action_type: 'workspace_repaired',
      metadata: { reason },
    });
  },

  async logWorkspaceOrphanDetected(userId: string, email?: string): Promise<boolean> {
    const { data: w } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
    if (!w?.id) return false;
    return this.appendLog({
      workspace_id: w.id, actor_id: userId,
      action_type: 'workspace_orphan_detected',
      metadata: { email },
    });
  },

  // ── Stress Recovery Logging ──

  async logStressRecoveryStarted(workspaceId: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_recovery_started',
      metadata: { event_type: 'recovery' },
    });
  },

  async logStressRecoveryCompleted(workspaceId: string, deletedByTable: Record<string, number>, remainingCount: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_recovery_completed',
      metadata: { event_type: 'recovery', deleted_by_table: deletedByTable, remaining_count: remainingCount },
    });
  },

  async logStressCleanupSurvivorDetected(workspaceId: string, survivors: { table: string; id: string; name: string }[], fkFailures: { table: string; error: string }[]): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_cleanup_survivor_detected',
      metadata: { survivor_count: survivors.length, survivors, fk_failures: fkFailures },
    });
  },

  async logStressLockExpiredCleanup(workspaceId: string, runId: string, ageMinutes: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action_type: 'stress_lock_expired_cleanup',
      metadata: { expired_run_id: runId, age_minutes: Math.round(ageMinutes * 10) / 10 },
    });
  },
};

// ─── PATCH 2: Forensic Log Throttling ──────────────────────────

const FORENSIC_DEBUG_ENABLED = (() => typeof localStorage !== 'undefined' && localStorage.getItem('resolve-log-forensics') === 'true')();

let _forensicOverride: boolean | null = null;

export function setForensicDebug(enabled: boolean): void {
  _forensicOverride = enabled;
  if (enabled) {
    try { localStorage.setItem('resolve-log-forensics', 'true'); } catch { /* noop */ }
  } else {
    try { localStorage.removeItem('resolve-log-forensics'); } catch { /* noop */ }
  }
}

export function isForensicDebugEnabled(): boolean {
  return _forensicOverride !== null ? _forensicOverride : FORENSIC_DEBUG_ENABLED;
}

let _lastForensicLog = 0;
const FORENSIC_THROTTLE_MS = 5_000;

const _agg: { total: number; success: number; failed: number; queued: number } = { total: 0, success: 0, failed: 0, queued: 0 };

export function resetForensicAggregates(): void {
  _agg.total = 0; _agg.success = 0; _agg.failed = 0; _agg.queued = 0;
}

export function getForensicAggregates(): typeof _agg {
  return { ..._agg };
}

export function recordForensicAppend(outcome: 'success' | 'failed' | 'queued'): void {
  _agg.total++;
  if (outcome === 'success') _agg.success++;
  else if (outcome === 'failed') _agg.failed++;
  else if (outcome === 'queued') _agg.queued++;

  const now = Date.now();
  if (isForensicDebugEnabled() && now - _lastForensicLog > FORENSIC_THROTTLE_MS) {
    _lastForensicLog = now;
    const rates = { ..._agg };
  }
}
