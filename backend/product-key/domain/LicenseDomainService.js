const License = require('../models/License');
const AuditEvent = require('../models/AuditEvent');
const logger = require('../lib/logger');

class BackendPlatformError extends Error {
  constructor({ code, message, details, correlationId, retryable = false, httpStatus, category }) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.details = details;
    this.correlationId = correlationId;
    this.retryable = retryable;
    this.httpStatus = httpStatus || 500;
    this.category = category || 'System';
  }

  toResponse(fallbackCorrelationId) {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      correlationId: this.correlationId || fallbackCorrelationId,
      retryable: this.retryable,
      category: this.category
    };
  }
}

class LicenseDomainService {
  async activateLicense({ productKey, workspaceId, userId, ip, geo, userAgent, traceContext }) {
    if (!productKey || productKey === 'OFFLINE-LICENSE') return null;

    const ctx = traceContext;
    const licSpan = logger.startSpan('LICENSE', 'LIC-201', ctx);

    const initialCheck = await License.findOne({ key: productKey });
    if (!initialCheck) {
      licSpan.finish('FAILED', { errorCode: 'LICENSE_NOT_FOUND', errorMessage: 'Invalid product key' });
      throw new BackendPlatformError({
        code: 'LICENSE_NOT_FOUND', message: 'Invalid product key', httpStatus: 404, category: 'Validation', correlationId: ctx.correlationId
      });
    }
    if (initialCheck.status === 'REVOKED') {
      licSpan.finish('FAILED', { errorCode: 'LICENSE_REVOKED', errorMessage: 'Key has been revoked' });
      throw new BackendPlatformError({
        code: 'LICENSE_REVOKED', message: 'Key has been revoked', httpStatus: 403, category: 'Authorization', correlationId: ctx.correlationId
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
      { returnDocument: 'after' } // fixed deprecated `new: true`
    );

    if (!activatedLicense) {
      const existingUsed = await License.findOne({ key: productKey, workspaceId });
      if (existingUsed) {
        logger.info('LICENSE', 'LIC-202', ctx, 'Idempotent re-onboard: license already active for this workspace');
        licSpan.finish('SUCCESS');
        return existingUsed;
      }
      licSpan.finish('FAILED', { errorCode: 'LICENSE_ALREADY_USED', errorMessage: 'License assigned to another workspace' });
      throw new BackendPlatformError({
        code: 'LICENSE_ALREADY_USED', message: 'License assigned to another workspace', httpStatus: 409, category: 'Conflict', correlationId: ctx.correlationId
      });
    }

    logger.info('LICENSE', 'LIC-202', ctx, 'MongoDB license activated');
    licSpan.finish('SUCCESS');
    return activatedLicense;
  }

  async rollbackLicenseActivation({ productKey, workspaceId, traceContext }) {
    if (!productKey || productKey === 'OFFLINE-LICENSE') return;
    const ctx = traceContext;
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
      logger.info('LICENSE', 'LIC-202', ctx, 'MongoDB license rollback succeeded');
    } catch (e) {
      logger.error('LICENSE', 'LIC-202', ctx, `CRITICAL: MongoDB rollback failed — manual intervention required: ${e.message}`);
      AuditEvent.create({
        event_type: 'onboard_rollback_failed', reason: `Rollback error: ${e.message}`, device_hash: workspaceId, license_key: productKey
      }).catch(() => {});
    }
  }
}

module.exports = { LicenseDomainService, BackendPlatformError };
