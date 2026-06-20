require('dotenv').config({ path: '../backend/product-key/.env' });
const mongoose = require('mongoose');

// Use production License schema
const License = require('../backend/product-key/models/License');

async function runMigration() {
    console.log('[MIGRATION] Starting RC19 Data Normalization...');

    const uri = process.env.MONGO_URI || process.env.DB || process.env.DATABASE_URL;

    if (!uri) {
        console.error('[FATAL] No MONGO_URI provided in environment. Exiting.');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);

        console.log('[MIGRATION] Connected to MongoDB.');

        const db = mongoose.connection.db;

        // Check existing collections
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        if (!collectionNames.includes('licenses')) {
            console.log('[MIGRATION] No "licenses" collection found. Nothing to migrate.');
            return;
        }

        console.log('[MIGRATION] Reading from "licenses" collection for in-place migration...');

        const legacyKeys = await db
            .collection('licenses')
            .find({ isActive: { $exists: true } })
            .toArray();

        console.log(`[MIGRATION] Found ${legacyKeys.length} legacy licenses needing update.`);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const oldDoc of legacyKeys) {
            try {
                const key = oldDoc.productKey || oldDoc.key;

                if (!key) {
                    console.warn(`[WARN] Skipping document without license key: ${oldDoc._id}`);
                    skipped++;
                    continue;
                }

                let status = 'ACTIVE';

                if (typeof oldDoc.isActive === 'boolean') {
                    status = oldDoc.isActive ? 'ACTIVE' : 'REVOKED';
                } else if (oldDoc.status) {
                    status = oldDoc.status;
                }

                const result = await db.collection('licenses').updateOne(
                    { _id: oldDoc._id },
                    { 
                        $set: { status: status },
                        $unset: { isActive: "" }
                    }
                );

                if (result.modifiedCount > 0) {
                    updated++;
                } else {
                    skipped++;
                }

            } catch (err) {
                console.error(
                    `[ERROR] Failed document ${oldDoc._id}:`,
                    err.message
                );
                errors++;
            }
        }

        console.log('');
        console.log('================================');
        console.log('[MIGRATION] Normalization Complete');
        console.log('================================');
        console.log(`Inserted : ${inserted}`);
        console.log(`Updated  : ${updated}`);
        console.log(`Skipped  : ${skipped}`);
        console.log(`Errors   : ${errors}`);
        console.log('================================');

    } catch (error) {
        console.error('[FATAL] Migration failed:', error);

    } finally {
        await mongoose.disconnect();
        console.log('[MIGRATION] Disconnected from MongoDB.');
    }
}

runMigration();