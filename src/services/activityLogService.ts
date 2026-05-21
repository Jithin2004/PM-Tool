import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../utils/cryptoUtils';

export interface ActivityLogEntry {
  id?: string;
  workspace_id: string;
  actor_id?: string;
  project_id?: string;
  task_id?: string;
  action: string;
  metadata: Record<string, any>;
  previous_hash?: string;
  hash?: string;
  created_at?: string;
}

export const activityLogService = {
  async getPreviousHash(workspaceId: string): Promise<string> {
    if (!isSupabaseConfigured) return 'GENESIS_BLOCK';
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('hash')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.hash) return data.hash;
    } catch (e) {
      console.warn('ActivityLogService: getPreviousHash failed:', e);
    }
    return 'GENESIS_BLOCK';
  },

  async computeHash(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash'>, previousHash: string): Promise<string> {
    const message = `${entry.workspace_id}${entry.actor_id ?? ''}${entry.project_id ?? ''}${entry.task_id ?? ''}${entry.action}${JSON.stringify(entry.metadata)}${previousHash}${new Date().toISOString()}`;
    return sha256(message);
  },

  async appendLog(entry: Omit<ActivityLogEntry, 'hash' | 'previous_hash' | 'id' | 'created_at'>): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    if (!entry.workspace_id) {
      console.warn('ActivityLogService: appendLog skipped — no workspace_id');
      return false;
    }
    try {
      const previousHash = await this.getPreviousHash(entry.workspace_id);
      const hash = await this.computeHash(entry, previousHash);
      const { error } = await supabase.from('activity_logs').insert({
        workspace_id: entry.workspace_id,
        actor_id: entry.actor_id,
        project_id: entry.project_id,
        task_id: entry.task_id,
        action: entry.action,
        metadata: entry.metadata,
        previous_hash: previousHash,
        hash
      });
      if (error) {
        console.error('ActivityLogService: appendLog failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('ActivityLogService: appendLog exception:', e);
      return false;
    }
  },

  async getLogs(workspaceId: string, projectId?: string, taskId?: string): Promise<ActivityLogEntry[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      if (taskId) query = query.eq('task_id', taskId);
      const { data, error } = await query;
      if (!error && data) return data as ActivityLogEntry[];
    } catch (e) {
      console.warn('ActivityLogService: getLogs failed:', e);
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
        currentPrevHash = log.hash!;
        continue;
      }
      if (log.previous_hash !== currentPrevHash) return { valid: false, tamperedIndex: i };
      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) return { valid: false, tamperedIndex: i };
      currentPrevHash = log.hash!;
    }
    return { valid: true, tamperedIndex: null };
  },

  async verifyHashChain(workspaceId: string): Promise<{ status: 'Valid' | 'Broken' | 'GENESIS_RESET' | 'Suspicious'; logCount: number; tamperedIndex: number | null; message: string }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { status: 'Valid', logCount: 0, tamperedIndex: null, message: 'No logs to verify' };

    // Check genesis mismatch at index 0
    if (logs.length > 0) {
      const first = logs[0];
      if (!first.previous_hash || first.previous_hash === 'GENESIS_BLOCK') {
        // Legacy genesis — not corruption
      } else if (first.previous_hash !== 'GENESIS_BLOCK') {
        // First entry has a non-genesis hash pointing to nothing — legacy reset
        await this.logHashChainVerified(workspaceId, 'GENESIS_RESET', logs.length, 0);
        return { status: 'GENESIS_RESET', logCount: logs.length, tamperedIndex: 0, message: 'Chain initialized from legacy records' };
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
        currentPrevHash = log.hash!;
        continue;
      }

      // Non-genesis hash mismatch = real corruption
      if (log.previous_hash !== currentPrevHash) {
        if (!broken) { broken = true; firstBad = i; }
        continue;
      }

      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) {
        if (!broken) { broken = true; firstBad = i; }
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
    if (broken) {
      await this.logHashChainVerified(workspaceId, 'Broken', logs.length, firstBad);
      return { status: 'Broken', logCount: logs.length, tamperedIndex: firstBad, message: `Chain broken at index ${firstBad}` };
    }
    if (suspicious) {
      await this.logHashChainVerified(workspaceId, 'Suspicious', logs.length, null);
      return { status: 'Suspicious', logCount: logs.length, tamperedIndex: null, message: 'Chain valid but timestamps out of order' };
    }
    await this.logHashChainVerified(workspaceId, 'Valid', logs.length, null);
    return { status: 'Valid', logCount: logs.length, tamperedIndex: null, message: 'Chain intact' };
  },

  async verifyHashChainDetailed(workspaceId: string): Promise<{ valid: boolean; brokenIndex: number | null; severity: 'none' | 'warning' | 'critical'; reason: string }> {
    const logs = await this.getLogs(workspaceId);
    if (logs.length === 0) return { valid: true, brokenIndex: null, severity: 'none', reason: 'No logs' };

    if (logs.length > 0) {
      const first = logs[0];
      if (first.previous_hash && first.previous_hash !== 'GENESIS_BLOCK') {
        return { valid: false, brokenIndex: 0, severity: 'warning', reason: 'Chain initialized from legacy records' };
      }
    }

    let currentPrevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (i === 0 && (!log.previous_hash || log.previous_hash === 'GENESIS_BLOCK')) {
        currentPrevHash = log.hash!;
        continue;
      }
      if (log.previous_hash !== currentPrevHash) {
        return { valid: false, brokenIndex: i, severity: 'critical', reason: `Hash mismatch at index ${i}` };
      }
      const recomputed = await this.computeHash(log, log.previous_hash!);
      if (log.hash !== recomputed) {
        return { valid: false, brokenIndex: i, severity: 'critical', reason: `Tampered hash at index ${i}` };
      }
      currentPrevHash = log.hash!;
    }
    return { valid: true, brokenIndex: null, severity: 'none', reason: 'Chain intact' };
  },

  // ── Command Intelligence Event Logging ──

  async logHeatmapView(workspaceId: string, actorId?: string, metadata?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'command_heatmap_viewed',
      metadata: { ...metadata, event_type: 'heatmap_view' },
    });
  },

  async logPredictionUsed(workspaceId: string, actorId?: string, predictionId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'workflow_prediction_used',
      metadata: { prediction_id: predictionId, event_type: 'prediction_used' },
    });
  },

  async logFrictionDetected(workspaceId: string, actorId?: string, frictionData?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'workflow_friction_detected',
      metadata: { ...frictionData, event_type: 'friction_detected' },
    });
  },

  async logHealthGenerated(workspaceId: string, actorId?: string, healthData?: Record<string, any>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'command_health_generated',
      metadata: { ...healthData, event_type: 'health_generated' },
    });
  },

  // ── Ecosystem Event Logging ──

  async logIntegrationConnected(workspaceId: string, service: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'integration_connected',
      metadata: { service },
    });
  },

  async logIntegrationSync(workspaceId: string, service: string, itemsSynced: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'integration_sync',
      metadata: { service, items_synced: itemsSynced },
    });
  },

  async logFileUploaded(workspaceId: string, fileName: string, taskId?: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId, task_id: taskId,
      action: 'file_uploaded',
      metadata: { file_name: fileName, task_id: taskId },
    });
  },

  async logFileVersionCreated(workspaceId: string, docId: string, version: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'file_version_created',
      metadata: { doc_id: docId, version },
    });
  },

  async logDocumentCreated(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'document_created',
      metadata: { doc_id: docId, title },
    });
  },

  async logAnnotationAdded(workspaceId: string, docId: string, annotationId: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'annotation_added',
      metadata: { doc_id: docId, annotation_id: annotationId },
    });
  },

  // ── Stage 2 Hardening Logging ──

  async logSyncQueued(workspaceId: string, queueId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_sync_queued',
      metadata: { queue_id: queueId, service },
    });
  },

  async logSyncStarted(workspaceId: string, queueId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_sync_started',
      metadata: { queue_id: queueId, service },
    });
  },

  async logSyncCompleted(workspaceId: string, queueId: string, service: string, itemsSynced?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_sync_completed',
      metadata: { queue_id: queueId, service, items_synced: itemsSynced },
    });
  },

  async logSyncRetry(workspaceId: string, queueId: string, service: string, attempt: number, backoffMs: number, error?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_sync_retry',
      metadata: { queue_id: queueId, service, attempt, backoff_ms: backoffMs, error },
    });
  },

  async logOAuthStateCreated(workspaceId: string, provider: string, expiresAt: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'oauth_state_created',
      metadata: { provider, expires_at: expiresAt },
    });
  },

  async logOAuthStateVerified(workspaceId: string, sessionId: string, provider: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'oauth_state_verified',
      metadata: { oauth_session_id: sessionId, provider },
    });
  },

  // ── Queue Persistence Logging ──

  async logJobCreated(workspaceId: string, jobId: string, service: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_job_created',
      metadata: { job_id: jobId, service },
    });
  },

  async logJobRecovered(workspaceId: string, jobId: string, service: string, status: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_job_recovered',
      metadata: { job_id: jobId, service, previous_status: status },
    });
  },

  async logJobCompleted(workspaceId: string, jobId: string, service: string, itemsSynced?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_job_completed',
      metadata: { job_id: jobId, service, items_synced: itemsSynced },
    });
  },

  async logJobFailed(workspaceId: string, jobId: string, service: string, error: string, attempts: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'integration_job_failed',
      metadata: { job_id: jobId, service, error, attempts },
    });
  },

  // ── Stage 3 Ignition Logging ──

  async logAutomationCreated(workspaceId: string, ruleId: string, name: string, triggerEvent: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'automation_created',
      metadata: { rule_id: ruleId, name, trigger_event: triggerEvent },
    });
  },

  async logAutomationExecuted(workspaceId: string, ruleId: string, ruleName: string, event: string, payloadKeys: string[]): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'automation_executed',
      metadata: { rule_id: ruleId, rule_name: ruleName, event, payload_keys: payloadKeys },
    });
  },

  async logApprovalCreated(workspaceId: string, instanceId: string, targetType: string, targetId: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'approval_created',
      metadata: { instance_id: instanceId, target_type: targetType, target_id: targetId },
    });
  },

  async logApprovalCompleted(workspaceId: string, instanceId: string, targetType: string, targetId: string, result: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'approval_completed',
      metadata: { instance_id: instanceId, target_type: targetType, target_id: targetId, result },
    });
  },

  async logApiKeyCreated(workspaceId: string, keyId: string, name: string, permissions: string[]): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'api_key_created',
      metadata: { key_id: keyId, name, permissions },
    });
  },

  async logWebhookSent(workspaceId: string, webhookId: string, webhookName: string, event: string, statusCode: number, attempt: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'webhook_sent',
      metadata: { webhook_id: webhookId, webhook_name: webhookName, event, status_code: statusCode, attempt },
    });
  },

  async logTemplateInstalled(workspaceId: string, templateId: string, templateName: string, ruleId: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'workflow_template_installed',
      metadata: { template_id: templateId, template_name: templateName, rule_id: ruleId },
    });
  },

  // ── Launch Hardening Logging ──

  async logWebhookTriggered(workspaceId: string, event: string, webhookCount: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'webhook_triggered',
      metadata: { event, webhook_count: webhookCount },
    });
  },

  async logTriggerEvaluated(workspaceId: string, event: string, ruleCount: number, depth: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'automation_trigger_evaluated',
      metadata: { event, rule_count: ruleCount, depth },
    });
  },

  async logApiRequest(workspaceId: string, endpoint: string, method: string, statusCode: number, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'api_request_processed',
      metadata: { endpoint, method, status_code: statusCode },
    });
  },

  async logRoleGuardRejected(workspaceId: string, action: string, userId: string, requiredRole: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'role_guard_rejected',
      metadata: { attempted_action: action, user_id: userId, required_role: requiredRole },
    });
  },

  async logSessionExpired(workspaceId: string, userId: string, reason: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'session_expired',
      metadata: { user_id: userId, reason },
    });
  },

  async logHashChainVerified(workspaceId: string, chainStatus: string, logCount: number, tamperedIndex?: number | null): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'hash_chain_verified',
      metadata: { chain_status: chainStatus, log_count: logCount, tampered_index: tamperedIndex },
    });
  },

  async logSimulationCompleted(workspaceId: string, successCount: number, failureCount: number, recoveryCount: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'system_simulation_completed',
      metadata: { success_count: successCount, failure_count: failureCount, recovery_count: recoveryCount },
    });
  },

  // ── Production Observability ──

  async logClientError(workspaceId: string, source: string, message: string, stack?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'client_error_events',
      metadata: { source, message, stack: stack?.slice(0, 500) },
    });
  },

  async logQueueFailure(workspaceId: string, queueId: string, service: string, error: string, attempt: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'queue_failure_events',
      metadata: { queue_id: queueId, service, error, attempt },
    });
  },

  async logApiFailure(workspaceId: string, endpoint: string, method: string, statusCode: number, error: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'api_failure_events',
      metadata: { endpoint, method, status_code: statusCode, error },
    });
  },

  async logRenderFailure(workspaceId: string, boundary: string, error: string, componentStack?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'render_failure_events',
      metadata: { boundary, error, component_stack: componentStack?.slice(0, 500) },
    });
  },

  // ── Document Soft Delete Logging ──

  async logDocumentDeleted(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'document_deleted',
      metadata: { doc_id: docId, title },
    });
  },

  async logDocumentRestored(workspaceId: string, docId: string, title: string, actorId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'document_restored',
      metadata: { doc_id: docId, title },
    });
  },

  async logDocumentArchivedViewed(workspaceId: string, actorId?: string, archivedCount?: number): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      action: 'document_archived_viewed',
      metadata: { archived_count: archivedCount },
    });
  },

  // ── Stress Test Safety Logging ──

  async logStressTestBlocked(workspaceId: string, reason: string, runId?: string): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'stress_test_blocked',
      metadata: { reason, blocked_run_id: runId },
    });
  },

  async logStressTestDryRun(workspaceId: string, runId: string, estimate: Record<string, number>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'stress_test_dry_run',
      metadata: { run_id: runId, estimate },
    });
  },

  async logStressCleanupManual(workspaceId: string, runId: string, cleaned: Record<string, number>): Promise<boolean> {
    return this.appendLog({
      workspace_id: workspaceId,
      action: 'stress_cleanup_manual',
      metadata: { run_id: runId, cleaned },
    });
  },
};
