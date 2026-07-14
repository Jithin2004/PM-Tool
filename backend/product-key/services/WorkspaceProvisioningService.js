const crypto = require('crypto');
const { getPlanSeats } = require('../controller/helpers');
const { BackendPlatformError } = require('../domain/LicenseDomainService'); // Adjust path
const AuditEvent = require('../models/AuditEvent');
const logger = require('../lib/logger');
const EnterpriseEventRecorder = require('./EnterpriseEventRecorder');

function mapLicensePlanToWorkspacePlan(plan, ctx) {
    if (!plan) {
        throw new BackendPlatformError({
            code: 'INVALID_LICENSE_PLAN',
            message: 'License plan is missing or undefined',
            httpStatus: 400,
            category: 'Validation',
            correlationId: ctx?.correlationId || ''
        });
    }

    const normalizedPlan = String(plan).trim().toUpperCase();

    switch (normalizedPlan) {
        case 'STARTER':
            return 'standard';
        case 'BUSINESS':
            return 'premium';
        case 'ENTERPRISE':
            return 'enterprise';
        default:
            throw new BackendPlatformError({
                code: 'INVALID_LICENSE_PLAN',
                message: `Unknown license plan: ${plan}`,
                httpStatus: 400,
                category: 'Validation',
                correlationId: ctx?.correlationId || ''
            });
    }
}
class WorkspaceProvisioningService {
  constructor(identityDomainService, licenseDomainService, workspaceDomainService) {
    this.identityDomainService = identityDomainService;
    this.licenseDomainService = licenseDomainService;
    this.workspaceDomainService = workspaceDomainService;
    this._idempotencyCache = new Map();
    this.IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
  }

  _getIdempotencyKey(req) {
    const h = req.headers['x-idempotency-key'];
    if (h && typeof h === 'string' && h.length > 0 && h.length <= 128) {
      return `idem:${h}`;
    }
    return null;
  }

  _checkIdempotency(key) {
    if (!key) return null;
    const entry = this._idempotencyCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._idempotencyCache.delete(key); return null; }
    return entry.response;
  }

  _storeIdempotency(key, response) {
    if (!key) return;
    this._idempotencyCache.set(key, { response, expiresAt: Date.now() + this.IDEMPOTENCY_TTL_MS });
  }

  async provisionWorkspace(req, command, traceContext) {
    let ctx = traceContext;
    const wspSpan = logger.startSpan('WORKSPACE', 'WSP-301', ctx);

    const { productKey, workspaceName } = command;
    const workspaceId = crypto.randomUUID(); // Generate workspaceId internally since it's provisioning

    // 1. Validation
    if (!workspaceName || typeof workspaceName !== 'string' || workspaceName.trim().length < 2 || workspaceName.trim().length > 100) {
      wspSpan.finish('FAILED', { errorCode: 'INVALID_INPUT', errorMessage: 'workspaceName must be 2–100 characters' });
      throw new BackendPlatformError({ code: 'INVALID_INPUT', message: 'workspaceName must be 2–100 characters', httpStatus: 400, category: 'Validation', correlationId: ctx.correlationId });
    }

    // Identity Validation via Domain Service (strictly from JWT)
    let identity;
    try {
      identity = this.identityDomainService.verifyIdentity(req.user);
    } catch (e) {
      wspSpan.finish('FAILED', { errorCode: 'AUTH_USER_NOT_FOUND', errorMessage: 'User identity missing or invalid' });
      throw new BackendPlatformError({ code: 'AUTH_USER_NOT_FOUND', message: 'User identity missing or invalid', httpStatus: 401, category: 'Authentication', correlationId: ctx.correlationId });
    }

    // Idempotency
    const idempotencyKey = this._getIdempotencyKey(req);
    const cachedResponse = this._checkIdempotency(idempotencyKey);
    if (cachedResponse) {
      logger.info('WORKSPACE', 'WSP-301', ctx, 'Returning cached idempotent response');
      wspSpan.finish('SUCCESS');
      return cachedResponse;
    }

    logger.info('WORKSPACE', 'WSP-301', ctx, 'WorkspaceProvisioningStarted');

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = null; // geoip-lite lookup if available
    const userAgent = req.headers['user-agent'];

    let activatedLicense = null;

    try {
      // 2. License Activation (LIC-201 span evaluates inside LicenseDomainService)
      activatedLicense = await this.licenseDomainService.activateLicense({
        productKey, workspaceId, userId: identity.id, ip, geo, userAgent, traceContext: ctx
      });

      // Update TraceContext with user and license parameters
      ctx = logger.createContext(ctx.correlationId, ctx.runId, req.user, { id: workspaceId, name: workspaceName }, activatedLicense);
      req.traceContext = ctx;

      // 3. Workspace Creation & Owner Setup (Postgres RPC)
      const mongoPlan = activatedLicense ? activatedLicense.plan : 'STARTER';
      const workspacePlan = mapLicensePlanToWorkspacePlan(mongoPlan, ctx);
      const seats = activatedLicense ? getPlanSeats(mongoPlan) : 5;

      await this.workspaceDomainService.createWorkspace({
        workspaceId,
        workspaceName,
        userId: identity.id,
        userEmail: identity.email,
        userName: identity.fullName,
        licenseKey: productKey || 'OFFLINE-LICENSE',
        plan: workspacePlan,
        seats,
        traceContext: ctx
      });

      // Success
      const responseBody = {
        workspaceId,
        workspaceName: workspaceName.trim(),
        status: 'ACTIVE',
        message: 'Workspace successfully provisioned',
        plan: activatedLicense ? activatedLicense.plan : 'STANDARD'
      };

      logger.info('WORKSPACE', 'WSP-302', ctx, 'WorkspaceCreated');

      try {
        if (activatedLicense) {
          await EnterpriseEventRecorder.recordEvent({
            workspace_id: workspaceId,
            user_id: identity.id,
            actor_name: identity.fullName || 'System',
            entity_type: 'license',
            entity_id: productKey,
            verb: 'license_activated',
            title: 'License Activated',
            description: `License activated for plan ${mongoPlan}.`,
            severity: 'low',
            importance: 'important',
            icon_key: 'warning',
            ip_address: ip,
            device: userAgent || 'server',
            is_system: false,
            visibility: 'admin',
            origin: 'backend',
            module: 'licensing',
            metadata: { plan: mongoPlan }
          });
        }

        await EnterpriseEventRecorder.recordEvent({
          workspace_id: workspaceId,
          user_id: identity.id,
          actor_name: identity.fullName || 'System',
          entity_type: 'workspace',
          entity_id: workspaceId,
          verb: 'workspace_created',
          title: 'Workspace Provisioned',
          description: `Workspace "${workspaceName}" successfully provisioned on plan "${workspacePlan}".`,
          severity: 'low',
          importance: 'important',
          icon_key: 'project',
          ip_address: ip,
          device: userAgent || 'server',
          is_system: false,
          visibility: 'public',
          origin: 'backend',
          module: 'workspace',
          metadata: { plan: workspacePlan, seats }
        });
      } catch (e) {
        logger.error('WORKSPACE', 'WSP-ERR', ctx, `Failed to record provisioning events: ${e.message}`);
      }

      AuditEvent.create({
        event_type: 'onboard_workspace',
        reason: 'Workspace onboarding completed',
        device_hash: workspaceId,
        license_key: productKey || 'OFFLINE-LICENSE'
      }).catch(() => {});

      this._storeIdempotency(idempotencyKey, responseBody);

      wspSpan.finish('SUCCESS');
      return responseBody;
    } catch (error) {
      wspSpan.finish('FAILED', { errorCode: error.code || 'PROVISIONING_FAILED', errorMessage: error.message });

      // Compensation: Rollback MongoDB license activation if we got that far
      if (activatedLicense) {
        await this.licenseDomainService.rollbackLicenseActivation({ productKey, workspaceId, traceContext: ctx });
      }

      if (error instanceof BackendPlatformError) {
        throw error;
      }
      throw new BackendPlatformError({
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Server error during onboarding',
        httpStatus: 500,
        category: 'Unexpected',
        correlationId: ctx.correlationId
      });
    }
  }
}

module.exports = { WorkspaceProvisioningService };
