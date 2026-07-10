const crypto = require('crypto');
const { log, getPlanSeats } = require('../controller/helpers');
const { BackendPlatformError } = require('./LicenseDomainService');

class WorkspaceDomainService {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
  }

  async createWorkspace({ workspaceId, workspaceName, userId, userEmail, userFullName, executionMode, defaultLanes, workflowRules, settings, correlationId }) {
    if (!this.supabaseAdmin) {
      log('warn', correlationId, 'Supabase Admin not configured — skipping database setup', { workspaceId });
      return;
    }

    const rpcPayload = {
      p_workspace_id: workspaceId,
      p_workspace_name: workspaceName.trim(),
      p_user_id: userId,
      p_user_email: userEmail || '',
      p_user_full_name: userFullName || '',
      p_execution_mode: executionMode || 'KANBAN',
      p_settings: settings || {},
      p_default_lanes: defaultLanes || 5,
      p_workflow_rules: workflowRules || {}
    };

    const { error: rpcError } = await this.supabaseAdmin.rpc('onboard_workspace_transaction', rpcPayload);

    if (rpcError) {
      log('error', correlationId, 'Supabase RPC failed', { workspaceId, rpcError: rpcError.message });
      throw new BackendPlatformError({
        code: 'WORKSPACE_PROVISIONING_FAILED',
        message: 'Database transaction failed: ' + rpcError.message,
        httpStatus: 500,
        category: 'Infrastructure',
        correlationId
      });
    }

    log('info', correlationId, 'PostgreSQL RPC committed', { workspaceId });
  }

  async syncSupabaseLicense({ productKey, workspaceId, plan, correlationId, retryCount = 0 }) {
    const MAX_RETRIES = 2;
    const RETRY_BASE_MS = 400;

    if (!this.supabaseAdmin) return;

    try {
      const hashedKey = crypto.createHash('sha256').update(productKey).digest('hex');
      const planType = (plan || 'business').toLowerCase();
      const seats = getPlanSeats(plan);

      const { error } = await this.supabaseAdmin
        .from('workspace_license')
        .upsert(
          {
            workspace_id: workspaceId,
            license_key_hash: hashedKey,
            activation_date: new Date().toISOString(),
            allowed_users: seats,
            license_type: planType
          },
          { onConflict: 'workspace_id' }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`workspace_license upsert failed: ${error.message}`);
      }

      log('info', correlationId, 'License synced to Supabase', { workspaceId, planType, seats });
    } catch (e) {
      if (retryCount < MAX_RETRIES) {
        const delayMs = RETRY_BASE_MS * (retryCount + 1);
        log('warn', correlationId, `syncSupabaseLicense attempt ${retryCount + 1} failed; retrying in ${delayMs}ms`, { workspaceId, error: e.message });
        await new Promise(r => setTimeout(r, delayMs));
        return this.syncSupabaseLicense({ productKey, workspaceId, plan, correlationId, retryCount: retryCount + 1 });
      }
      log('error', correlationId, 'syncSupabaseLicense failed after all retries', { workspaceId, error: e.message });
      throw new BackendPlatformError({
        code: 'LICENSE_SYNC_FAILED',
        message: e.message,
        httpStatus: 500,
        category: 'Infrastructure',
        correlationId
      });
    }
  }
}

module.exports = { WorkspaceDomainService };
