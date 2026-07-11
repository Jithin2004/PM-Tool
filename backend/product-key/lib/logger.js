'use strict';

const pino = require('pino');
const ErrorRegistry = require('./errorRegistry');

// Build Metadata initialized once on startup
const BUILD_METADATA = {
    version: '1.3.2',
    gitRevision: process.env.GIT_REV || '8d42af',
    environment: process.env.NODE_ENV || 'production',
    buildTimestamp: new Date().toISOString()
};

// Observability levels mapping to integer priorities for threshold checks
const LEVELS = { TRACE: 10, DEBUG: 20, INFO: 30, WARN: 40, ERROR: 50, FATAL: 60, AUDIT: 70, SECURITY: 80 };

const configLevel = (process.env.OBSERVABILITY_LEVEL || 'INFO').toUpperCase();
const configPriority = LEVELS[configLevel] || LEVELS.INFO;

// Underlying pino instance
const pinoLogger = pino({
    level: 'trace', // We filter levels dynamically in our wrapper
    formatters: {
        level(label) { return { level: label.toUpperCase() }; }
    },
    base: { service: 'resolve-pm-licensing' },
    timestamp: pino.stdTimeFunctions.isoTime
});

// Redaction rules
const SECRET_KEYS = ['password', 'jwt', 'token', 'authorization', 'secret', 'service_role_key'];

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);

    const copy = {};
    for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (SECRET_KEYS.some(secret => lowerKey.includes(secret))) {
            // Special exception: preserve last 4 of product keys if specified in context
            if (lowerKey === 'productkey' && typeof obj[key] === 'string') {
                copy[key] = obj[key] === 'OFFLINE-LICENSE' ? 'OFFLINE-****' : `****-${obj[key].slice(-4)}`;
            } else {
                copy[key] = '[REDACTED]';
            }
        } else if (typeof obj[key] === 'object') {
            copy[key] = sanitize(obj[key]);
        } else {
            copy[key] = obj[key];
        }
    }
    return copy;
}

function writeLog(level, category, stage, status, context, message, extra = {}) {
    const priority = LEVELS[level] || LEVELS.INFO;
    if (priority < configPriority) return; // Silent if below threshold

    const sanitizedContext = sanitize(context);
    const sanitizedExtra = sanitize(extra);

    const payload = {
        timestamp: new Date().toISOString(),
        level,
        category,
        stage,
        status,
        correlationId: context ? context.correlationId : undefined,
        runId: context ? context.runId : undefined,
        build: BUILD_METADATA,
        context: sanitizedContext ? sanitizedContext.context : undefined,
        message,
        ...sanitizedExtra
    };

    // Auto-elevate log levels for latency checks
    if (payload.durationMs !== undefined) {
        if (payload.durationMs > 2000) {
            payload.level = 'ERROR';
        } else if (payload.durationMs > 500) {
            payload.level = 'WARN';
        }
    }

    const logMethod = (level === 'AUDIT' || level === 'SECURITY')
        ? 'info'
        : level.toLowerCase();
    
    if (pinoLogger[logMethod]) {
        pinoLogger[logMethod](payload);
    } else {
        pinoLogger.info(payload);
    }
}

class Span {
    constructor(category, stage, context) {
        this.category = category;
        this.stage = stage;
        this.context = context;
        this.startTime = Date.now();
        writeLog('TRACE', category, stage, 'STARTED', context, `Span ${stage} started`);
    }

    finish(status, extra = {}) {
        const durationMs = Date.now() - this.startTime;
        let level = 'INFO';
        if (status === 'FAILED') {
            level = 'ERROR';
        }
        writeLog(level, this.category, this.stage, status, this.context, `Span ${this.stage} completed`, { durationMs, ...extra });
    }
}

const logger = {
    trace: (cat, stage, ctx, msg, extra) => writeLog('TRACE', cat, stage, 'SUCCESS', ctx, msg, extra),
    debug: (cat, stage, ctx, msg, extra) => writeLog('DEBUG', cat, stage, 'SUCCESS', ctx, msg, extra),
    info: (cat, stage, ctx, msg, extra) => writeLog('INFO', cat, stage, 'SUCCESS', ctx, msg, extra),
    warn: (cat, stage, ctx, msg, extra) => writeLog('WARN', cat, stage, 'SUCCESS', ctx, msg, extra),
    error: (cat, stage, ctx, msg, extra) => writeLog('ERROR', cat, stage, 'FAILED', ctx, msg, extra),
    fatal: (cat, stage, ctx, msg, extra) => writeLog('FATAL', cat, stage, 'FAILED', ctx, msg, extra),
    audit: (cat, stage, ctx, msg, extra) => writeLog('AUDIT', cat, stage, 'SUCCESS', ctx, msg, extra),
    security: (cat, stage, ctx, msg, extra) => writeLog('SECURITY', cat, stage, 'FAILED', ctx, msg, extra),
    
    startSpan: (category, stage, context) => new Span(category, stage, context),
    
    createContext: (correlationId, runId, user = null, workspace = null, license = null) => {
        return {
            correlationId: correlationId || '',
            runId: runId || '',
            startedAt: new Date().toISOString(),
            context: {
                user: user ? { id: user.id, email: user.email, role: user.role } : undefined,
                workspace: workspace ? { id: workspace.id, name: workspace.name } : undefined,
                license: license ? { productKey: license.productKey, plan: license.plan, seats: license.seats } : undefined
            }
        };
    }
};

module.exports = logger;
