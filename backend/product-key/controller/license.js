const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const geoip = require('geoip-lite');
const { createClient } = require('@supabase/supabase-js');
const License = require('../models/License');
const AuditEvent = require('../models/AuditEvent');
const { log, isValidUUID, maskKey, getPlanSeats } = require('./helpers');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not configured in environment. Exiting...');
    process.exit(1);
}

// Prefer the server-side env var; accept the Vite-prefixed one for backward compatibility only.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
} else {
    console.warn('[WARNING] Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) not found. Supabase synchronization will be disabled.');
}

// ── Idempotency Cache ─────────────────────────────────────────────────────────
// Simple in-memory TTL store keyed on X-Idempotency-Key header.
// NOTE: This is single-instance safe only. For horizontally scaled deployments,
//       replace with a shared Redis cache (e.g. ioredis SET EX).
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const _idempotencyCache = new Map();

function _getIdempotencyKey(req) {
    const h = req.headers['x-idempotency-key'];
    if (h && typeof h === 'string' && h.length > 0 && h.length <= 128) {
        return `idem:${h}`;
    }
    return null;
}

function _checkIdempotency(key) {
    if (!key) return null;
    const entry = _idempotencyCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { _idempotencyCache.delete(key); return null; }
    return entry.response;
}

function _storeIdempotency(key, response) {
    if (!key) return;
    _idempotencyCache.set(key, { response, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
}
// Plan features mapping
function getFeaturesForPlan(plan) {
    switch (plan) {
        case 'STARTER':
            return ['basic_reporting'];
        case 'BUSINESS':
            return ['basic_reporting', 'advanced_analytics', 'timeline_prediction'];
        case 'ENTERPRISE':
            return ['basic_reporting', 'advanced_analytics', 'timeline_prediction', 'audit_ledger', 'custom_rules'];
        default:
            return ['basic_reporting'];
    }
}

// Generate XXXXX-XXXXX-XXXXX-XXXXX license key
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

// 1. Initial Keys Setup
// REMOVED: Hardcoded keys from source code.
// Use the seed_licenses.js script to initialize keys from environment variables.
// Run: node seed_licenses.js
// Set SEED_LICENSE_KEYS=KEY1,KEY2,... in your .env before running.
const initialKeys = [];

exports.addLicense = async (req, res) => {
    try {
        await Promise.all(initialKeys.map(async (k) => {
            const existing = await License.findOne({ key: k });
            if (!existing) {
                await License.create({
                    key: k,
                    plan: 'BUSINESS',
                    status: 'AVAILABLE',
                    activation_limit: 3
                });
                await AuditEvent.create({
                    event_type: 'license_created',
                    reason: 'Developer bootstrap key initialization',
                    device_hash: 'system',
                    license_key: k
                });
            }
        }));
        res.status(200).json({ success: true, message: 'All product keys initialized.' });
    } catch (e) {
        console.error('Failed to initialize keys:', e);
        res.status(500).json({ error: 'Failed to initialize keys' });
    }
};

/**
 * Syncs an activated license to the Supabase workspace_license table.
 *
 * Uses a single UPSERT to eliminate the previous read-then-write race condition
 * where two concurrent requests could both see no row and both attempt INSERT.
 *
 * Retries up to MAX_RETRIES times with linear back-off before throwing.
 *
 * @param {string} productKey  - Raw product key (hashed before storage)
 * @param {string} workspaceId - Target workspace UUID
 * @param {string} plan        - License plan name
 * @param {string} correlationId - Request correlation ID for logging
 * @param {number} [retryCount=0] - Internal retry counter
 */
async function syncSupabaseLicense(productKey, workspaceId, plan, correlationId = 'system', retryCount = 0) {
    const MAX_RETRIES = 2;
    const RETRY_BASE_MS = 400;

    if (!supabaseAdmin) {
        log('warn', correlationId, 'Supabase not initialised — skipping license sync', { workspaceId });
        return;
    }

    try {
        const hashedKey = crypto.createHash('sha256').update(productKey).digest('hex');
        const planType = (plan || 'business').toLowerCase();
        const seats = getPlanSeats(plan);

        // Single UPSERT — eliminates read-then-write race condition.
        // onConflict targets the unique constraint on workspace_id.
        const { data, error } = await supabaseAdmin
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
            log('warn', correlationId, `syncSupabaseLicense attempt ${retryCount + 1} failed; retrying in ${delayMs}ms`, {
                workspaceId, error: e.message
            });
            await new Promise(r => setTimeout(r, delayMs));
            return syncSupabaseLicense(productKey, workspaceId, plan, correlationId, retryCount + 1);
        }
        log('error', correlationId, 'syncSupabaseLicense failed after all retries', { workspaceId, error: e.message });
        throw e;
    }
}

// 2. License Key Activation
exports.activateLicense = async (req, res) => {
    const { productKey, workspaceId, userIdentifier } = req.body;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    const userAgent = req.headers["user-agent"];

    if (!productKey || !workspaceId) {
        return res.status(400).json({ error: 'Product key and workspace ID are required.' });
    }

    try {
        const initialCheck = await License.findOne({ key: productKey });

        if (!initialCheck) {
            await AuditEvent.create({ event_type: 'verification_failed', reason: 'Invalid product key provided', device_hash: workspaceId, license_key: productKey });
            return res.status(404).json({ error: 'Invalid product key' });
        }

        if (initialCheck.status === 'REVOKED') {
            await AuditEvent.create({ event_type: 'verification_failed', reason: `License has been ${initialCheck.status.toLowerCase()}`, device_hash: workspaceId, license_key: productKey });
            return res.status(403).json({ error: `Key has been ${initialCheck.status.toLowerCase()}` });
        }

        // ATOMIC ACTIVATION TRANSACTION
        const license = await License.findOneAndUpdate(
            { key: productKey, isUsed: false, status: 'AVAILABLE' },
            {
                $set: {
                    isUsed: true,
                    status: "ACTIVE",
                    activatedAt: new Date(),
                    usedAt: new Date(),
                    usedBy: userIdentifier || workspaceId,
                    workspaceId,
                    activation: {
                        ip, country: geo?.country, region: geo?.region, city: geo?.city, timezone: geo?.timezone, userAgent, source: "web"
                    },
                    last_verified_at: new Date()
                }
            },
            { new: true }
        );

        if (!license) {
            const existingUsed = await License.findOne({ key: productKey, workspaceId });
            if (existingUsed) {
                try {
                    await syncSupabaseLicense(productKey, workspaceId, existingUsed.plan);
                } catch (syncError) {
                    return res.status(500).json({ error: 'Backend synchronization failed: ' + syncError.message });
                }

                const token = jwt.sign({ key: existingUsed.key, workspaceId: workspaceId }, JWT_SECRET, { expiresIn: '30d' });
                await AuditEvent.create({ event_type: 'license_activated', reason: 'Existing workspace re-verified', device_hash: workspaceId, license_key: productKey });
                return res.json({ success: true, token, plan: existingUsed.plan });
            }

            await AuditEvent.create({ event_type: 'verification_failed', reason: 'License assigned to another workspace', device_hash: workspaceId, license_key: productKey });
            return res.status(403).json({ error: 'License assigned to another workspace' });
        }

        try {
            await syncSupabaseLicense(productKey, workspaceId, license.plan);
        } catch (syncError) {
            // Rollback Mongo Activation since Supabase failed
            await License.findOneAndUpdate(
                { key: productKey },
                {
                    $set: {
                        isUsed: false,
                        status: "AVAILABLE",
                        activatedAt: null,
                        usedAt: null,
                        usedBy: null,
                        workspaceId: null,
                        activation: null,
                        last_verified_at: null
                    }
                }
            );
            return res.status(500).json({ error: 'Backend synchronization failed: ' + syncError.message });
        }

        const token = jwt.sign({ key: license.key, workspaceId: workspaceId }, JWT_SECRET, { expiresIn: '30d' });
        await AuditEvent.create({ event_type: 'license_activated', reason: 'New workspace registered', device_hash: workspaceId, license_key: productKey });
        res.json({ success: true, token, plan: license.plan });

    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};



// 3. License Key Verification
exports.verifyLicense = async (req, res) => {
    const { productKey } = req.body;

    if (!productKey) {
        return res.status(400).json({ error: 'Product key is required' });
    }

    try {
        const license = await License.findOne({ key: productKey });

        // 1. If license doesn't exist at all, fail immediately
        if (!license) {
            try {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: 'License key not found',
                    device_hash: 'unauthenticated',
                    license_key: productKey
                });
            } catch (auditErr) {
                console.error('Audit logging failed background execution:', auditErr.message);
            }
            return res.status(401).json({ valid: false, message: 'Invalid or expired license' });
        }

        // 2. If license is already used, refuse it to prevent onboarding continuation
        if (license.isUsed) {
            try {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: 'License key already used',
                    device_hash: 'unauthenticated',
                    license_key: productKey
                });
            } catch (auditErr) {
                console.error('Audit logging failed background execution:', auditErr.message);
            }
            return res.status(403).json({ valid: false, isUsed: true, message: 'License key has already been activated' });
        }

        // 3. If license exists but is not ACTIVE or AVAILABLE (e.g. REVOKED), exit cleanly
        if (license.status !== 'ACTIVE' && license.status !== 'AVAILABLE') {
            try {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: `License is in status ${license.status}`,
                    device_hash: 'unauthenticated',
                    license_key: productKey
                });
            } catch (auditErr) {
                console.error('Audit logging failed background execution:', auditErr.message);
            }
            return res.status(401).json({ valid: false, message: 'Invalid or expired license' });
        }

        // Update verification time in the background safely
        try {
            await License.updateOne(
                { _id: license._id },
                { $set: { last_verified_at: new Date() } }
            );
        } catch (saveErr) {
            console.error('Failed to update last_verified_at timestamp:', saveErr.message);
        }

        // Secure response payload matching frontend overview expectations.
        return res.status(200).json({
            valid: true,
            isUsed: false,
            licenseId: license.key,
            message: 'License verified',
            plan: license.plan || 'STANDARD',
            seats: license.activation_limit || 3,
            supportUntil: license.support_until || null,
            features: getFeaturesForPlan(license.plan || 'STANDARD')
        });

    } catch (error) {
        console.error('Verification logic fallback crash prevention:', error);
        return res.status(401).json({ valid: false, message: 'Invalid or expired license structure' });
    }
};

// 3b. License Token Verification (GET)
exports.verifyLicenseToken = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ valid: false, message: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];

    // REMOVED: UUID bypass that accepted any UUID string as a valid BUSINESS license.
    // All tokens must be properly signed JWTs issued by this server.

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const license = await License.findOne({ key: decoded.key });

        if (!license || license.status !== 'ACTIVE') {
            return res.status(401).json({ valid: false, message: 'Invalid or expired license' });
        }

        return res.status(200).json({
            valid: true,
            keyId: license.key,
            plan: license.plan || 'STANDARD',
            seats: getPlanSeats(license.plan),
            supportUntil: license.support_until || null,
            features: getFeaturesForPlan(license.plan || 'STANDARD'),
            environment: 'Cloud'
        });
    } catch (e) {
        return res.status(401).json({ valid: false, message: 'Invalid token' });
    }
};

// 4. Admin API: Generate Keys
exports.adminGenerateKey = async (req, res) => {
    const { plan, activation_limit, purchase_metadata } = req.body;

    const validatedPlan = ['STARTER', 'BUSINESS', 'ENTERPRISE'].includes(plan) ? plan : 'BUSINESS';
    const limit = parseInt(activation_limit, 10) || 3;

    try {
        const key = generateLicenseKey();
        const license = await License.create({
            key,
            plan: validatedPlan,
            activation_limit: limit,
            purchase_metadata: purchase_metadata || {}
        });

        await AuditEvent.create({
            event_type: 'license_created',
            reason: 'Admin manual generation',
            device_hash: 'admin',
            license_key: key
        });

        res.status(201).json({
            success: true,
            key: license.key,
            plan: license.plan,
            activation_limit: license.activation_limit
        });
    } catch (error) {
        console.error('Admin key generation error:', error);
        res.status(500).json({ error: 'Failed to generate key' });
    }
};

// 5. Admin API: Disable Keys
exports.adminDisableKey = async (req, res) => {
    const { productKey } = req.body;

    if (!productKey) {
        return res.status(400).json({ error: 'Product key is required' });
    }

    const targetStatus = 'REVOKED';

    try {
        const license = await License.findOne({ key: productKey });

        if (!license) {
            return res.status(404).json({ error: 'Product key not found' });
        }

        license.status = targetStatus;
        // isUsed is automatically derived in pre-save hook
        await license.save();

        await AuditEvent.create({
            event_type: 'license_revoked',
            reason: `Admin manual change to status: ${targetStatus}`,
            device_hash: 'admin',
            license_key: productKey
        });

        res.json({ success: true, message: `License key status set to ${targetStatus}` });
    } catch (error) {
        console.error('Admin key disable error:', error);
        res.status(500).json({ error: 'Failed to update key status' });
    }
};

exports.adminResetKey = async (req, res) => {
    const { productKey } = req.body;
    if (!productKey) return res.status(400).json({ error: 'Product key is required' });

    try {
        const license = await License.findOneAndUpdate(
            { key: productKey },
            {
                $set: {
                    status: 'AVAILABLE',
                    isUsed: false,
                    activated_devices: []
                },
                $unset: {
                    activatedAt: "",
                    usedAt: "",
                    last_verified_at: "",
                    workspaceId: "",
                    usedBy: "",
                    activation: ""
                }
            },
            { new: true }
        );
        if (!license) return res.status(404).json({ error: 'Product key not found' });

        await AuditEvent.create({
            event_type: 'license_reset',
            reason: 'Admin manual reset to AVAILABLE',
            device_hash: 'admin',
            license_key: productKey
        });

        res.json({ success: true, message: 'License key successfully reset to AVAILABLE' });
    } catch (error) {
        console.error('Admin key reset error:', error);
        res.status(500).json({ error: 'Failed to reset key' });
    }
};

// 6. Admin API: View Activations
// 6. Admin API: View All License Activations
exports.adminGetActivations = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000); // Cap at 1000
        const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

        // Excludes Mongo document IDs and internal metadata fields
        const licenses = await License.find({}, { _id: 0, __v: 0 })
            .limit(limit)
            .skip(skip)
            .lean();

        const total = await License.countDocuments({});
        res.json({ data: licenses, total, limit, skip });
    } catch (error) {
        console.error('Admin fetch activations error:', error);
        res.status(500).json({ error: 'Failed to fetch activations' });
    }
};

// 7. Admin API: View Audit Events
exports.adminGetEvents = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000); // Cap at 1000
        const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

        // Excludes Mongo document IDs
        const events = await AuditEvent.find({}, { _id: 0, __v: 0 })
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const total = await AuditEvent.countDocuments({});
        res.json({ data: events, total, limit, skip });
    } catch (error) {
        console.error('Admin fetch events error:', error);
        res.status(500).json({ error: 'Failed to fetch audit events' });
    }
};// 2b. Atomic Workspace Onboarding
exports.onboardWorkspace = async (req, res) => {
    // Every request gets a unique correlation ID for end-to-end tracing.
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    const { productKey, workspaceId, workspaceName, executionMode, defaultLanes, workflowRules, settings, user } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    // ── Input Validation ──────────────────────────────────────────────────────
    if (!workspaceId || !isValidUUID(workspaceId)) {
        return res.status(400).json({ error: 'Missing or invalid workspaceId (must be a valid UUID)' });
    }
    if (!workspaceName || typeof workspaceName !== 'string' ||
        workspaceName.trim().length < 2 || workspaceName.trim().length > 100) {
        return res.status(400).json({ error: 'workspaceName must be 2–100 characters' });
    }
    if (!user?.id || !isValidUUID(user.id)) {
        return res.status(400).json({ error: 'Missing or invalid user.id (must be a valid UUID)' });
    }

    // ── Identity Verification ─────────────────────────────────────────────────
    // req.user is set by auth middleware (jwt.verify). The body user.id must
    // match the authenticated subject — prevents impersonation.
    if (!req.user?.id || req.user.id !== user.id) {
        log('warn', correlationId, 'Identity mismatch between JWT sub and request body user.id', {
            jwtUserId: req.user?.id, bodyUserId: user.id
        });
        return res.status(403).json({ error: 'User identity mismatch' });
    }

    // ── Idempotency Check ─────────────────────────────────────────────────────
    // If the client sends X-Idempotency-Key and we have a cached successful
    // response, return it immediately without re-running the flow.
    const idempotencyKey = _getIdempotencyKey(req);
    const cachedResponse = _checkIdempotency(idempotencyKey);
    if (cachedResponse) {
        log('info', correlationId, 'Returning cached idempotent response', { workspaceId, idempotencyKey });
        return res.json(cachedResponse);
    }

    log('info', correlationId, 'Onboarding started', {
        workspaceId, userId: user.id,
        productKey: maskKey(productKey),
        workspaceName: workspaceName.trim()
    });

    const geo = geoip.lookup(ip);
    const userAgent = req.headers['user-agent'];

    try {
        // ── Step 1: MongoDB License Activation ────────────────────────────────
        let activatedLicense = null;
        if (productKey && productKey !== 'OFFLINE-LICENSE') {
            const initialCheck = await License.findOne({ key: productKey });
            if (!initialCheck) {
                return res.status(404).json({ error: 'Invalid product key' });
            }
            if (initialCheck.status === 'REVOKED') {
                return res.status(403).json({ error: 'Key has been revoked' });
            }

            activatedLicense = await License.findOneAndUpdate(
                { key: productKey, isUsed: false, status: 'AVAILABLE' },
                {
                    $set: {
                        isUsed: true,
                        status: 'ACTIVE',
                        activatedAt: new Date(),
                        usedAt: new Date(),
                        usedBy: user.id,
                        workspaceId,
                        activation: { ip, country: geo?.country, region: geo?.region,
                                      city: geo?.city, timezone: geo?.timezone, userAgent, source: 'web' },
                        last_verified_at: new Date()
                    }
                },
                { new: true }
            );

            if (!activatedLicense) {
                // License already used — check if it belongs to THIS workspace (idempotent re-onboard)
                const existingUsed = await License.findOne({ key: productKey, workspaceId });
                if (existingUsed) {
                    log('info', correlationId, 'Idempotent re-onboard: license already active for this workspace', {
                        workspaceId, productKey: maskKey(productKey)
                    });
                    activatedLicense = existingUsed;
                } else {
                    return res.status(403).json({ error: 'License assigned to another workspace' });
                }
            } else {
                log('info', correlationId, 'MongoDB license activated', {
                    workspaceId, productKey: maskKey(productKey), plan: activatedLicense.plan
                });
            }
        }

        // ── Step 2: PostgreSQL Atomic Onboarding RPC ──────────────────────────
        if (supabaseAdmin) {
            const rpcPayload = {
                p_workspace_id: workspaceId,
                p_workspace_name: workspaceName.trim(),
                p_user_id: user.id,
                p_user_email: user.email || '',
                p_user_full_name: user.full_name || user.name || '',
                p_execution_mode: executionMode || 'KANBAN',
                p_settings: settings || {},
                p_default_lanes: defaultLanes || 5,
                p_workflow_rules: workflowRules || {}
            };

            const { error: rpcError } = await supabaseAdmin.rpc('onboard_workspace_transaction', rpcPayload);

            if (rpcError) {
                log('error', correlationId, 'Supabase RPC failed', { workspaceId, rpcError: rpcError.message });
                throw new Error('Database transaction failed: ' + rpcError.message);
            }

            log('info', correlationId, 'PostgreSQL RPC committed', { workspaceId });

            // ── Step 3: Sync License Metadata to Supabase ─────────────────────
            // Runs after RPC commit. Uses UPSERT with up to 2 retries.
            // Failure here triggers rollback of the MongoDB activation.
            if (activatedLicense) {
                await syncSupabaseLicense(productKey, workspaceId, activatedLicense.plan, correlationId);
            }
        } else {
            log('warn', correlationId, 'Supabase Admin not configured — skipping database setup', { workspaceId });
        }

        // ── Build and Return Response ─────────────────────────────────────────
        const responseToken = activatedLicense
            ? jwt.sign({ key: activatedLicense.key, workspaceId }, JWT_SECRET, { expiresIn: '30d' })
            : null;

        const responseBody = { success: true, token: responseToken, plan: activatedLicense?.plan || 'STANDARD' };

        const durationMs = Date.now() - startTime;
        log('info', correlationId, 'Onboarding completed successfully', {
            workspaceId, userId: user.id, durationMs, rollbackAttempted: false
        });

        // Fire-and-forget audit write — must not throw into the happy path.
        AuditEvent.create({
            event_type: 'onboard_workspace',
            reason: 'Workspace onboarding completed',
            device_hash: workspaceId,
            license_key: productKey || 'OFFLINE-LICENSE'
        }).catch(e => log('warn', correlationId, 'Audit event write failed (non-fatal)', { error: e.message }));

        // Cache success for idempotent retries.
        _storeIdempotency(idempotencyKey, responseBody);

        return res.json(responseBody);

    } catch (error) {
        const durationMs = Date.now() - startTime;
        log('error', correlationId, 'Onboarding failed — initiating MongoDB rollback', {
            workspaceId, error: error.message, durationMs
        });

        // ── Compensating Transaction: Roll Back MongoDB Activation ────────────
        // The PostgreSQL RPC is self-contained and rolled back by Postgres on
        // failure. We must compensate the MongoDB activation manually.
        if (productKey && productKey !== 'OFFLINE-LICENSE') {
            try {
                await License.findOneAndUpdate(
                    { key: productKey, workspaceId },
                    {
                        $set: {
                            isUsed: false, status: 'AVAILABLE',
                            activatedAt: null, usedAt: null, usedBy: null,
                            workspaceId: null, activation: null, last_verified_at: null
                        }
                    }
                );
                log('info', correlationId, 'MongoDB license rollback succeeded', {
                    workspaceId, productKey: maskKey(productKey)
                });
            } catch (rollbackError) {
                // CRITICAL: License consumed but workspace not created.
                // Requires manual remediation via POST /admin/reset.
                log('error', correlationId, 'CRITICAL: MongoDB rollback failed — manual intervention required', {
                    workspaceId,
                    productKey: maskKey(productKey),
                    rollbackError: rollbackError.message,
                    remediation: 'Call POST /admin/reset with the affected productKey'
                });
                // Record failed rollback for the audit trail — fire-and-forget.
                AuditEvent.create({
                    event_type: 'onboard_rollback_failed',
                    reason: `Rollback error: ${rollbackError.message}`,
                    device_hash: workspaceId,
                    license_key: productKey
                }).catch(() => {});
            }
        }

        return res.status(500).json({ error: error.message || 'Server error during onboarding' });
    }
};
