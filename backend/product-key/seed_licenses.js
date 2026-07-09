'use strict';

/**
 * seed_licenses.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script to seed initial license keys into MongoDB.
 *
 * This replaces the hardcoded initialKeys array that was previously in
 * controller/license.js. Keys are now stored only in environment variables,
 * never in source code.
 *
 * Usage:
 *   1. Add to .env:  SEED_LICENSE_KEYS=KEY1,KEY2,KEY3
 *   2. Run once:     node seed_licenses.js
 *   3. Confirm:      Check output — each key reports Created or Already exists.
 *
 * Safe to run multiple times — uses findOne before creating (idempotent).
 * Does NOT delete or modify existing keys.
 *
 * PLAN defaults to BUSINESS. Override with SEED_LICENSE_PLAN=STARTER|BUSINESS|ENTERPRISE
 * LIMIT defaults to 3. Override with SEED_LICENSE_LIMIT=N
 */

require('dotenv').config();

const mongoose = require('mongoose');
const License = require('./models/License');
const AuditEvent = require('./models/AuditEvent');

async function main() {
    const dbUri = process.env.MONGO_URI || process.env.DB || process.env.DATABASE_URL;
    if (!dbUri) {
        console.error('[SEED] No MongoDB URI found. Set MONGO_URI in your .env file.');
        process.exit(1);
    }

    const rawKeys = process.env.SEED_LICENSE_KEYS;
    if (!rawKeys) {
        console.error('[SEED] SEED_LICENSE_KEYS is not set. Nothing to seed.');
        console.error('[SEED] Add SEED_LICENSE_KEYS=KEY1,KEY2,KEY3 to your .env and re-run.');
        process.exit(1);
    }

    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        console.error('[SEED] SEED_LICENSE_KEYS is empty after parsing. Nothing to seed.');
        process.exit(1);
    }

    const plan = ['STARTER', 'BUSINESS', 'ENTERPRISE'].includes(process.env.SEED_LICENSE_PLAN)
        ? process.env.SEED_LICENSE_PLAN
        : 'BUSINESS';
    const limit = parseInt(process.env.SEED_LICENSE_LIMIT, 10) || 3;

    console.log(`[SEED] Connecting to MongoDB...`);
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`[SEED] Connected. Seeding ${keys.length} key(s) as plan=${plan}, limit=${limit}`);

    let created = 0;
    let skipped = 0;

    for (const key of keys) {
        const existing = await License.findOne({ key });
        if (existing) {
            console.log(`[SEED]  SKIP  ${key}  (already exists, status=${existing.status})`);
            skipped++;
            continue;
        }

        await License.create({ key, plan, status: 'AVAILABLE', activation_limit: limit });
        await AuditEvent.create({
            event_type: 'license_created',
            reason: 'Seeded via seed_licenses.js',
            device_hash: 'system',
            license_key: key
        });
        console.log(`[SEED]  OK    ${key}`);
        created++;
    }

    console.log(`\n[SEED] Done. Created: ${created}  Skipped (already exist): ${skipped}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('[SEED] Fatal error:', err.message);
    process.exit(1);
});
