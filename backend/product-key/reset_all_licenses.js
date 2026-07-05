require('dotenv').config();
const mongoose = require('mongoose');
const License = require('./models/License');

async function run() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('ERROR: MONGODB_URI or MONGO_URI is required in environment variables.');
        process.exit(1);
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const initialTotal = await License.countDocuments({});
    console.log(`\nTotal licenses found in inventory: ${initialTotal}`);

    console.log('\nExecuting bulk atomic reset...');
    const result = await License.updateMany(
        {},
        {
            $set: {
                status: "AVAILABLE",
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
        }
    );

    console.log(`Total licenses modified: ${result.modifiedCount} (Matched: ${result.matchedCount})`);

    console.log('\nRunning Verification Checks...');
    
    const availableCount = await License.countDocuments({ status: 'AVAILABLE' });
    const activeCount = await License.countDocuments({ status: 'ACTIVE' });
    const revokedCount = await License.countDocuments({ status: 'REVOKED' });

    console.log(`\n--- Verification Summary ---`);
    console.log(`AVAILABLE licenses: ${availableCount}`);
    console.log(`ACTIVE licenses: ${activeCount}`);
    console.log(`REVOKED licenses: ${revokedCount}`);

    const failedStateCount = await License.countDocuments({
        $or: [
            { status: { $ne: 'AVAILABLE' } },
            { isUsed: { $ne: false } },
            { activatedAt: { $exists: true } },
            { usedAt: { $exists: true } },
            { workspaceId: { $exists: true } },
            { usedBy: { $exists: true } },
            { last_verified_at: { $exists: true } }
        ]
    });

    if (failedStateCount === 0 && availableCount === initialTotal) {
        console.log('\n✅ VERIFICATION PASSED: Entire key inventory is now in a fresh AVAILABLE state.');
    } else {
        console.error(`\n❌ VERIFICATION FAILED: ${failedStateCount} licenses still contain invalid or legacy states.`);
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Fatal error during reset:', err);
    process.exit(1);
});
