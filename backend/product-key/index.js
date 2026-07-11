'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const licenseController = require('./controller/license');

// ── Startup: Validate Critical Environment Variables ──────────────────────────
// Fail fast so a misconfigured deployment is obvious immediately.
const REQUIRED_ENV = [
    'JWT_SECRET',                // Signs/verifies license tokens issued by this server
    'SUPABASE_URL',              // Base URL for Supabase API
    'SUPABASE_ANON_KEY',         // Used to verify authentication tokens via the API
    'SUPABASE_SERVICE_ROLE_KEY', // Supabase service role for orchestration/RPC calls
    'LICENSE_ADMIN_SECRET'       // Protects /admin/* endpoints
];
const MISSING_ENV = REQUIRED_ENV.filter(v => !process.env[v]);
if (MISSING_ENV.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${MISSING_ENV.join(', ')}`);
    console.error('[FATAL] Server cannot start safely. Exiting.');
    process.exit(1);
}

// Ensure MongoDB is configured
if (!process.env.ALLOWED_ORIGINS) {
    console.warn('[WARNING] ALLOWED_ORIGINS is not set. All cross-origin requests will be rejected.');
}
if (!process.env.MONGO_URI && !process.env.DB && !process.env.DATABASE_URL) {
    console.error('[FATAL] No MongoDB URI configured (MONGO_URI, DB, or DATABASE_URL). Exiting.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 10000;

const logger = require('./lib/logger');
const crypto = require('crypto');

// ── Observability Trace Middleware ────────────────────────────────────────────
app.use((req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
    const runId = req.headers['x-run-id'] || crypto.randomUUID();
    
    req.traceContext = logger.createContext(correlationId, runId);
    
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Run-ID', runId);
    
    req.httpSpan = logger.startSpan('HTTP', 'HTTP-101', req.traceContext);
    
    res.on('finish', () => {
        const status = res.statusCode >= 400 ? 'FAILED' : 'SUCCESS';
        req.httpSpan.finish(status, {
            httpStatus: res.statusCode,
            method: req.method,
            url: req.originalUrl || req.url
        });
    });
    
    next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const defaultOrigins = ['http://localhost:5173', 'https://resolve-pm.vercel.app'];
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : defaultOrigins;

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Non-browser requests
        
        // Always preserve localhost origins for development safely
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not permitted`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-License-Admin-Secret',
        'X-Idempotency-Key'
    ],
    optionsSuccessStatus: 200 // legacy browser support for OPTIONS
}));

app.use(express.json({ limit: '256kb' })); // Prevent large-body attacks

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Applied per-endpoint. express-rate-limit v8 is already installed.

// Trust Render's proxy to accurately read X-Forwarded-For IPs for rate limiting
app.set('trust proxy', 1);

/** /verify and /activate: 10 requests per minute per IP */
const publicLicenseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait before trying again.' }
});

/** /onboard: stricter — 3 requests per minute per IP */
const onboardLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many onboarding requests. Please wait before trying again.' }
});

// ── Middleware ────────────────────────────────────────────────────────────────
const adminAuth = require('./middleware/adminAuth');
const authMiddleware = require('./middleware/auth');

// ── Health Check ──────────────────────────────────────────────────────────────
// Returns MongoDB connection state so load balancers and uptime monitors can
// distinguish a degraded server from a healthy one.
const healthCheckHandler = (req, res) => {
    const mongoose = require('mongoose');
    const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const dbState = mongoStates[mongoose.connection.readyState] || 'unknown';
    res.status(200).json({
        status: 'ok',
        service: 'resolve-pm-backend',
        version: '1.3.2',
        timestamp: new Date().toISOString(),
        db: dbState,
        uptime: process.uptime()
    });
};

app.get('/health', healthCheckHandler);
app.get('/', healthCheckHandler);
app.head('/', (req, res) => res.status(200).end());

// ── Public Licensing Endpoints ────────────────────────────────────────────────
app.post('/verify', publicLicenseLimiter, licenseController.verifyLicense);
app.get('/verify', publicLicenseLimiter, licenseController.verifyLicenseToken);
app.post('/activate', publicLicenseLimiter, licenseController.activateLicense);

// /onboard requires a verified Supabase JWT (authMiddleware) in addition to rate limiting.
app.post('/onboard', onboardLimiter, authMiddleware, licenseController.onboardWorkspace);

// ── Admin Endpoints ───────────────────────────────────────────────────────────
app.get('/addLicense', adminAuth, licenseController.addLicense);
app.post('/admin/generate', adminAuth, licenseController.adminGenerateKey);
app.post('/admin/disable', adminAuth, licenseController.adminDisableKey);
app.post('/admin/reset', adminAuth, licenseController.adminResetKey);
app.get('/admin/activations', adminAuth, licenseController.adminGetActivations);
app.get('/admin/events', adminAuth, licenseController.adminGetEvents);

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Allows in-flight requests to complete before the process exits.
// Render, Docker, and PM2 all send SIGTERM on deploy/restart.
process.on('SIGTERM', () => {
    logger.info('SYSTEM', 'SYS-101', null, '[SERVER] SIGTERM received — draining in-flight requests (5s window)...');
    setTimeout(() => {
        logger.info('SYSTEM', 'SYS-102', null, '[SERVER] Drain complete. Exiting.');
        process.exit(0);
    }, 5000);
});

// ── App Startup ───────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    logger.info('SYSTEM', 'SYS-103', null, `[SERVER] License server starting on port ${PORT}...`);
    try {
        await connectDB();
        logger.info('SYSTEM', 'SYS-104', null, `[SERVER] ✓ License server ready (port ${PORT})`);
    } catch (dbErr) {
        logger.error('SYSTEM', 'SYS-104', null, `[DB] MongoDB Connection Error: ${dbErr.message}`);
    }
});