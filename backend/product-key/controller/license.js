const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const License = require('../models/License');
const AuditEvent = require('../models/AuditEvent');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not configured in environment. Exiting...');
    process.exit(1);
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

// 1. Initial Keys Setup (For backward compatibility & developer onboarding)
let initialKeys = [
    "X7K-9M2-V4P-8LQ",
    "B3R-5N9-C1T-6JW",
    "H8F-2Y7-D4G-3MX",
    "W4P-9K6-L1R-5TV",
    "Q2M-8J3-X7N-9FC",
    "V6D-1Y5-H8B-2RG",
    "L9T-4W7-P3K-5MC",
    "N2C-8F6-J1X-9YQ",
    "R5B-9M4-V2H-7DT",
    "G3X-7K1-L8P-4NW"
];

exports.addLicense = async (req, res) => {
    try {
        await Promise.all(initialKeys.map(async (k) => {
            const existing = await License.findOne({ key: k });
            if (!existing) {
                await License.create({ 
                    key: k, 
                    plan: 'BUSINESS', 
                    status: 'ACTIVE', 
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

// 2. License Key Activation
exports.activateLicense = async (req, res) => {
    const { productKey, workspaceId } = req.body;

    if (!productKey || !workspaceId) {
        return res.status(400).json({ error: 'Product key and workspace ID are required.' });
    }

    try {
        const license = await License.findOne({ key: productKey });

        if (!license) {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'Invalid product key provided',
                device_hash: workspaceId,
                license_key: productKey
            });
            return res.status(404).json({ error: 'Invalid product key' });
        }

        if (license.status === 'EXPIRED') {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'License has expired',
                device_hash: workspaceId,
                license_key: productKey
            });
            return res.status(403).json({ error: 'Key has expired' });
        }

        if (license.status === 'REVOKED') {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'License has been revoked',
                device_hash: workspaceId,
                license_key: productKey
            });
            return res.status(403).json({ error: 'Key has been revoked' });
        }

        let isAlreadyActivated = false;

        // Check if license is already bound to a workspace
        if (license.activated_workspace_id) {
            if (license.activated_workspace_id === workspaceId) {
                isAlreadyActivated = true;
            } else {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: 'License assigned to another workspace',
                    device_hash: workspaceId,
                    license_key: productKey
                });
                return res.status(403).json({ error: 'License assigned to another workspace' });
            }
        } else {
            // Backward Compatibility Migration
            if (license.activated_devices && license.activated_devices.length > 0) {
                // Safely migrate the old fingerprint-based activation to workspace_id binding
                license.activated_workspace_id = workspaceId;
                isAlreadyActivated = true;
                // Preserve existing activation_at date
            } else {
                // True first activation
                license.activated_workspace_id = workspaceId;
                if (!license.activated_at) {
                    license.activated_at = new Date();
                }
            }
        }

        license.last_verified_at = new Date();
        await license.save();

        // Sign token containing only the key & workspaceId (no raw DB records)
        const token = jwt.sign(
            { key: license.key, workspaceId: workspaceId }, 
            JWT_SECRET, 
            { expiresIn: '30d' }
        );

        await AuditEvent.create({
            event_type: 'license_activated',
            reason: isAlreadyActivated ? 'Existing workspace re-verified' : 'New workspace registered',
            device_hash: workspaceId,
            license_key: productKey
        });

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

        // If license is missing or inactive, log audit event and exit cleanly
        if (!license || license.status !== 'ACTIVE') {
            try {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: !license ? 'License key not found' : `License is in status ${license.status}`,
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
            license.last_verified_at = new Date();
            await license.save();
        } catch (saveErr) {
            console.error('Failed to update last_verified_at timestamp:', saveErr.message);
        }

        // Secure response payload matching frontend overview expectations.
        return res.status(200).json({
            valid: true,
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
    const { productKey, status } = req.body; // status: 'EXPIRED' or 'REVOKED'

    if (!productKey) {
        return res.status(400).json({ error: 'Product key is required' });
    }

    const targetStatus = ['EXPIRED', 'REVOKED'].includes(status) ? status : 'REVOKED';

    try {
        const license = await License.findOne({ key: productKey });

        if (!license) {
            return res.status(404).json({ error: 'Product key not found' });
        }

        license.status = targetStatus;
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
};