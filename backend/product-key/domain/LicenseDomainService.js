const License = require('../models/License');
const AuditEvent = require('../models/AuditEvent');
const { log, maskKey, getPlanSeats } = require('../controller/helpers');
const { PlatformError } = require('../../../shared/contracts/error'); // Adjust path as needed for CJS? Wait, shared is TS.
// Since backend is pure JS, I will mock the PlatformError locally or require it if transpiled.
// Since the backend is CommonJS, we can just export a class locally or import if we use a TS transpiler.
// Actually, since shared is TS and backend is JS, maybe backend doesn't import from TS directly unless it uses ts-node.
// Let's create an error utility in backend to match the contract.

class BackendPlatformError extends Error {
  constructor({ code, message, details, correlationId, retryable = false, httpStatus, category }) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
    this.category = category;
  }
}

class LicenseDomainService {
  async activateLicense({ productKey, workspaceId, userId, ip, geo, userAgent, correlationId }) {
    if (!productKey || productKey === 'OFFLINE-LICENSE') return null;

    const initialCheck = await License.findOne({ key: productKey });
    if (!initialCheck) {
      throw new BackendPlatformError({
        code: 'INVALID_LICENSE', message: 'Invalid product key', httpStatus: 404, category: 'Validation', correlationId
      });
    }
    if (initialCheck.status === 'REVOKED') {
      throw new BackendPlatformError({
        code: 'LICENSE_REVOKED', message: 'Key has been revoked', httpStatus: 403, category: 'Authorization', correlationId
      });
    }

    const activatedLicense = await License.findOneAndUpdate(
      { key: productKey, isUsed: false, status: 'AVAILABLE' },
      {
        $set: {
          isUsed: true, status: 'ACTIVE', activatedAt: new Date(), usedAt: new Date(), usedBy: userId, workspaceId,
          activation: { ip, country: geo?.country, region: geo?.region, city: geo?.city, timezone: geo?.timezone, userAgent, source: 'web' },
          last_verified_at: new Date()
        }
      },
      { new: true }
    );

    if (!activatedLicense) {
      const existingUsed = await License.findOne({ key: productKey, workspaceId });
      if (existingUsed) {
        log('info', correlationId, 'Idempotent re-onboard: license already active for this workspace', { workspaceId, productKey: maskKey(productKey) });
        return existingUsed;
      }
      throw new BackendPlatformError({
        code: 'LICENSE_ALREADY_USED', message: 'License assigned to another workspace', httpStatus: 409, category: 'Conflict', correlationId
      });
    }

    log('info', correlationId, 'MongoDB license activated', { workspaceId, productKey: maskKey(productKey), plan: activatedLicense.plan });
    return activatedLicense;
  }

  async rollbackLicenseActivation({ productKey, workspaceId, correlationId }) {
    if (!productKey || productKey === 'OFFLINE-LICENSE') return;
    try {
      await License.findOneAndUpdate(
        { key: productKey, workspaceId },
        {
          $set: {
            isUsed: false, status: 'AVAILABLE', activatedAt: null, usedAt: null, usedBy: null,
            workspaceId: null, activation: null, last_verified_at: null
          }
        }
      );
      log('info', correlationId, 'MongoDB license rollback succeeded', { workspaceId, productKey: maskKey(productKey) });
    } catch (e) {
      log('error', correlationId, 'CRITICAL: MongoDB rollback failed — manual intervention required', { workspaceId, productKey: maskKey(productKey), error: e.message });
      AuditEvent.create({
        event_type: 'onboard_rollback_failed', reason: `Rollback error: ${e.message}`, device_hash: workspaceId, license_key: productKey
      }).catch(() => {});
    }
  }
}

module.exports = { LicenseDomainService, BackendPlatformError };
