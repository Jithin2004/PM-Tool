const crypto = require('crypto');
const { getPlanSeats } = require('../controller/helpers');
const { BackendPlatformError } = require('./LicenseDomainService');
const logger = require('../lib/logger');

class WorkspaceDomainService {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
  }

  async createWorkspace({ workspaceId, workspaceName, userId, userEmail, userName, licenseKey, plan, seats, traceContext }) {
    const ctx = traceContext;
    if (!this.supabaseAdmin) {
      logger.warn('WORKSPACE', 'RPC-401', ctx, 'Supabase Admin not configured — skipping database setup');
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

    const transactionStart = new Date().toISOString();
    const rpcSpan = logger.startSpan('RPC', 'RPC-401', ctx);

    const { error: rpcError } = await this.supabaseAdmin.rpc('onboard_workspace_transaction', rpcPayload);
    const transactionEnd = new Date().toISOString();

    if (rpcError) {
      const sqlState = rpcError.code || 'UNKNOWN';
      const constraint = rpcError.message?.match(/violates check constraint "([^"]+)"/)?.[1] || '';

      logger.error('RPC', 'RPC-401', ctx, `Supabase RPC failed: ${rpcError.message}`);
      rpcSpan.finish('FAILED', {
        rpcName: 'onboard_workspace_transaction',
        transactionStart,
        transactionEnd,
        sqlState,
        constraint,
        rowsAffected: 0,
        errorCode: 'WORKSPACE_TRANSACTION_FAILED',
        errorMessage: rpcError.message
      });

      throw new BackendPlatformError({
        code: 'WORKSPACE_TRANSACTION_FAILED',
        message: 'Database transaction failed: ' + rpcError.message,
        httpStatus: 500,
        category: 'Infrastructure',
        correlationId: ctx.correlationId
      });
    }

    logger.info('RPC', 'RPC-402', ctx, 'PostgreSQL RPC committed');
    rpcSpan.finish('SUCCESS', {
      rpcName: 'onboard_workspace_transaction',
      transactionStart,
      transactionEnd,
      sqlState: '00000',
      constraint: '',
      rowsAffected: 1 // VOID returns, we default to 1 successfully affected workspace
    });
  }
}

module.exports = { WorkspaceDomainService };
