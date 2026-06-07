const express = require('express');
const router = express.Router();
const licenseController = require('../controller/license');

// Admin protection middleware using LICENSE_SECRET
const adminAuth = (req, res, next) => {
    const adminSecret = process.env.LICENSE_SECRET;
    if (!adminSecret) {
        return res.status(500).json({ error: 'Administrative secret not configured on server' });
    }
    const clientSecret = req.headers['x-admin-secret'] || 
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
            ? req.headers.authorization.split(' ')[1] 
            : null);

    if (!clientSecret || clientSecret !== adminSecret) {
        return res.status(403).json({ error: 'Unauthorized: Invalid administrative secret key' });
    }
    next();
};

// ── Public Licensing Endpoints ──
router.post('/activate', licenseController.activateLicense);
router.get('/verify', licenseController.verifyLicense);

// Setup / Bootstrap helper
router.get('/addLicense', licenseController.addLicense);

// ── Admin Hardened Endpoints ──
router.post('/admin/license/generate', adminAuth, licenseController.adminGenerateKey);
router.post('/admin/license/disable', adminAuth, licenseController.adminDisableKey);
router.get('/admin/license/activations', adminAuth, licenseController.adminGetActivations);
router.get('/admin/license/events', adminAuth, licenseController.adminGetEvents);

module.exports = router;