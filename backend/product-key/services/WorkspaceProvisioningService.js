const crypto = require('crypto');
const { log, isValidUUID } = require('../controller/helpers');
const { BackendPlatformError } = require('../domain/LicenseDomainService'); // Adjust path
const AuditEvent = require('../models/AuditEvent');

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

  async provisionWorkspace(req, command, correlationId) {
    const startTime = Date.now();
    const { productKey, workspaceName } = command;
    const workspaceId = crypto.randomUUID(); // Generate workspaceId internally since it's provisioning

    // 1. Validation
    if (!workspaceName || typeof workspaceName !== 'string' || workspaceName.trim().length < 2 || workspaceName.trim().length > 100) {
      throw new BackendPlatformError({ code: 'INVALID_INPUT', message: 'workspaceName must be 2–100 characters', httpStatus: 400, category: 'Validation', correlationId });
    }

    // Identity Validation via Domain Service (strictly from JWT)
    let identity;
    try {
      identity = this.identityDomainService.verifyIdentity(req.user);
    } catch (e) {
      throw new BackendPlatformError({ code: 'UNAUTHENTICATED', message: 'User identity missing or invalid', httpStatus: 401, category: 'Authentication', correlationId });
    }

    // Idempotency
    const idempotencyKey = this._getIdempotencyKey(req);
    const cachedResponse = this._checkIdempotency(idempotencyKey);
    if (cachedResponse) {
      log('info', correlationId, 'Returning cached idempotent response', { workspaceId: cachedResponse.workspaceId, idempotencyKey });
      return cachedResponse;
    }

    log('info', correlationId, 'WorkspaceProvisioningStarted', {
      userId: identity.id, workspaceName: workspaceName.trim()
    });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const geo = null; // geoip-lite lookup if available
    const userAgent = req.headers['user-agent'];

    let activatedLicense = null;

    try {
      // 2. License Activation
      activatedLicense = await this.licenseDomainService.activateLicense({
        productKey, workspaceId, userId: identity.id, ip, geo, userAgent, correlationId
      });

      // 3. Workspace Creation & Owner Setup (Postgres RPC)
      // The RPC 'onboard_workspace_transaction' handles workspace, license sync, and user profile atomically.
      const plan = activatedLicense ? activatedLicense.plan : 'STANDARD';
      const seats = activatedLicense ? getPlanSeats(plan) : 10;

      await this.workspaceDomainService.createWorkspace({
        workspaceId,
        workspaceName,
        userId: identity.id,
        userEmail: identity.email,
        userName: identity.fullName,
        licenseKey: productKey || 'OFFLINE-LICENSE',
        plan,
        seats,
        correlationId
      });

      // Success
      const responseBody = {
        workspaceId,
        workspaceName: workspaceName.trim(),
        status: 'ACTIVE',
        message: 'Workspace successfully provisioned',
        plan: activatedLicense ? activatedLicense.plan : 'STANDARD'
      };

      const durationMs = Date.now() - startTime;
      log('info', correlationId, 'WorkspaceCreated', { workspaceId, userId: identity.id, durationMs });

      AuditEvent.create({
        event_type: 'onboard_workspace',
        reason: 'Workspace onboarding completed',
        device_hash: workspaceId,
        license_key: productKey || 'OFFLINE-LICENSE'
      }).catch(() => {});

      this._storeIdempotency(idempotencyKey, responseBody);

      return responseBody;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log('error', correlationId, 'WorkspaceProvisioningFailed', {
        workspaceId, error: error.message, durationMs
      });

      // Compensation: Rollback MongoDB license activation if we got that far
      if (activatedLicense) {
        await this.licenseDomainService.rollbackLicenseActivation({ productKey, workspaceId, correlationId });
      }

      if (error instanceof BackendPlatformError) {
        throw error;
      }
      throw new BackendPlatformError({
        code: 'PROVISIONING_FAILED',
        message: error.message || 'Server error during onboarding',
        httpStatus: 500,
        category: 'Unexpected',
        correlationId
      });
    }
  }
}

module.exports = { WorkspaceProvisioningService };
