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
    const { productKey, fingerprint } = req.body;

    if (!productKey || !fingerprint) {
        return res.status(400).json({ error: 'Product key and device fingerprint are required.' });
    }

    try {
        const license = await License.findOne({ key: productKey });

        if (!license) {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'Invalid product key provided',
                device_hash: fingerprint,
                license_key: productKey
            });
            return res.status(404).json({ error: 'Invalid product key' });
        }

        if (license.status === 'EXPIRED') {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'License has expired',
                device_hash: fingerprint,
                license_key: productKey
            });
            return res.status(403).json({ error: 'Key has expired' });
        }

        if (license.status === 'REVOKED') {
            await AuditEvent.create({
                event_type: 'verification_failed',
                reason: 'License has been revoked',
                device_hash: fingerprint,
                license_key: productKey
            });
            return res.status(403).json({ error: 'Key has been revoked' });
        }

        // Check if device is already activated
        const isAlreadyActivated = license.activated_devices.includes(fingerprint);

        if (!isAlreadyActivated) {
            // Check activation limits
            if (license.activated_devices.length >= license.activation_limit) {
                await AuditEvent.create({
                    event_type: 'activation_limit_reached',
                    reason: `Activation limit of ${license.activation_limit} reached`,
                    device_hash: fingerprint,
                    license_key: productKey
                });
                return res.status(403).json({ error: 'Activation limit reached' });
            }

            // Register device
            license.activated_devices.push(fingerprint);
            if (!license.activated_at) {
                license.activated_at = new Date();
            }
        }

        license.last_verified_at = new Date();
        await license.save();

        // Sign token containing only the key & fingerprint (no raw DB records)
        const token = jwt.sign(
            { key: license.key, fingerprint: fingerprint }, 
            JWT_SECRET, 
            { expiresIn: '30d' }
        );

        await AuditEvent.create({
            event_type: 'license_activated',
            reason: isAlreadyActivated ? 'Existing device re-verified' : 'New device registered',
            device_hash: fingerprint,
            license_key: productKey
        });

        res.json({ success: true, token, plan: license.plan });

    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// 3. License Key Verification
// Helper fallback inside the file to prevent crashes
const getFeaturesForPlan = (plan) => {
    const plans = {
        'ENTERPRISE': ['all_features', 'priority_support', 'ai_automation'],
        'PRO': ['all_features', 'priority_support'],
        'STANDARD': ['all_features']
    };
    return plans[plan] || ['standard_features'];
};

// 3. License Key Verification
exports.verifyLicense = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Dynamic fallback: read keyId if key doesn't exist
        const key = decoded.key || decoded.keyId;
        const fingerprint = decoded.fingerprint || 'legacy_device';

        if (!key) {
            return res.status(400).json({ error: 'Invalid token structure: Missing license identifier' });
        }

        const license = await License.findOne({ key });

        // If license is missing or inactive, log audit event and exit cleanly
        if (!license || license.status !== 'ACTIVE') {
            try {
                await AuditEvent.create({
                    event_type: 'verification_failed',
                    reason: !license ? 'License key not found' : `License is in status ${license.status}`,
                    device_hash: fingerprint,
                    license_key: key
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

        // Secure response payload matching frontend overview expectations
        return res.status(200).json({
            valid: true,
            activated: true,
            keyId: license.key,
            message: 'License verified',
            plan: license.plan || 'STANDARD',
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
exports.adminGetActivations = async (req, res) => {
    try {
        // Excludes Mongo document IDs and internal metadata fields
        const licenses = await License.find({}, { _id: 0, __v: 0 }).lean();
        res.json(licenses);
    } catch (error) {
        console.error('Admin fetch activations error:', error);
        res.status(500).json({ error: 'Failed to fetch activations' });
    }
};

// 7. Admin API: View Audit Events
exports.adminGetEvents = async (req, res) => {
    try {
        // Excludes Mongo document IDs
        const events = await AuditEvent.find({}, { _id: 0, __v: 0 }).sort({ timestamp: -1 }).lean();
        res.json(events);
    } catch (error) {
        console.error('Admin fetch events error:', error);
        res.status(500).json({ error: 'Failed to fetch audit events' });
    }
};