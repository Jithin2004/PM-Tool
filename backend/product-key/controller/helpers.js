'use strict';

const pino = require('pino');

// ── Logger ────────────────────────────────────────────────────────────────────
// Structured JSON logger. All output goes to stdout for collection by the host
// (Render, Docker, etc.). Set LOG_LEVEL env var to 'debug' for verbose output.
const pinoLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level(label) { return { level: label }; }
    },
    base: { service: 'resolve-pm-licensing' },
    timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Structured log helper.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} correlationId
 * @param {string} message
 * @param {object} meta
 */
function log(level, correlationId, message, meta = {}) {
    const VALID = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const safeLevel = VALID.includes(level) ? level : 'info';
    pinoLogger[safeLevel]({ correlationId, ...meta }, message);
}

// ── UUID Validation ───────────────────────────────────────────────────────────
// Accepts any UUID version (Supabase may use v4 or v1). Case-insensitive.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the value is a valid UUID string.
 * @param {*} str
 * @returns {boolean}
 */
function isValidUUID(str) {
    return typeof str === 'string' && UUID_REGEX.test(str);
}

// ── Key Masking ───────────────────────────────────────────────────────────────
/**
 * Masks a product key for safe logging.
 * "X7K2-ABCD-EFGH-IJKL" → "X7K2-****-****-****"
 * "OFFLINE-LICENSE"      → "OFFLINE-****"
 * @param {string} key
 * @returns {string}
 */
function maskKey(key) {
    if (!key || typeof key !== 'string') return '[no-key]';
    if (key === 'OFFLINE-LICENSE') return 'OFFLINE-****';
    const parts = key.split('-');
    if (parts.length < 2) return `${key.substring(0, 4)}****`;
    const masked = parts.slice(1).map(() => '****').join('-');
    return `${parts[0]}-${masked}`;
}

// ── Plan Configuration ────────────────────────────────────────────────────────
// Centralised plan-to-seat mapping. Change here, not scattered through handlers.
const PLAN_SEATS = {
    STARTER: 5,
    BUSINESS: 10,
    ENTERPRISE: 100
};

/**
 * Returns the allowed user-seat count for a given plan name.
 * Defaults to STARTER (5) for unknown plans.
 * @param {string} plan
 * @returns {number}
 */
function getPlanSeats(plan) {
    return PLAN_SEATS[(plan || '').toUpperCase()] ?? PLAN_SEATS.STARTER;
}

module.exports = { log, isValidUUID, maskKey, getPlanSeats };
