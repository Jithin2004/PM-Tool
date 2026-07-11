const crypto = require('crypto');
const { log, getPlanSeats } = require('../controller/helpers');
const { BackendPlatformError } = require('./LicenseDomainService');

class WorkspaceDomainService {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
  }

  async createWorkspace({ workspaceId, workspaceName, userId, userEmail, userName, licenseKey, plan, seats, correlationId }) {
    if (!this.supabaseAdmin) {
      log('warn', correlationId, 'Supabase Admin not configured — skipping database setup', { workspaceId });
      return;
    }

    const rpcPayload = {
      p_workspace_id: workspaceId,
      p_workspace_name: workspaceName.trim(),
      p_user_id: userId,
      p_user_email: userEmail || '',
      p_user_name: userName || '',
      p_license_key: licenseKey || '',
      p_plan: plan || 'standard',
      p_seats: seats || 10
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
}

module.exports = { WorkspaceDomainService };
