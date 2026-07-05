require('dotenv').config();
const mongoose = require('mongoose');
const License = require('./models/License');

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is required');
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB. Starting License normalization...');

    const licenses = await License.find({});
    let updatedCount = 0;

    for (const license of licenses) {
        let needsUpdate = false;

        // Normalizing legacy 'ACTIVE' + isUsed=false to 'AVAILABLE'
        if (!license.isUsed && license.status !== 'REVOKED') {
            if (license.status !== 'AVAILABLE' || license.activatedAt || license.usedAt || license.workspaceId || (license.activated_devices && license.activated_devices.length > 0)) {
                license.status = 'AVAILABLE';
                license.activatedAt = undefined;
                license.usedAt = undefined;
                license.last_verified_at = undefined;
                license.workspaceId = undefined;
                license.usedBy = undefined;
                license.activated_devices = [];
                license.activation = undefined;
                needsUpdate = true;
            }
        }

        // Normalizing legacy EXPIRED to REVOKED
        if (license.status === 'EXPIRED') {
            license.status = 'REVOKED';
            needsUpdate = true;
        }

        // Normalizing legacy CONSUMED to ACTIVE
        if (license.status === 'CONSUMED') {
            license.status = 'ACTIVE';
            needsUpdate = true;
        }

        // Normalizing ACTIVE states to ensure true usage fields
        if (license.status === 'ACTIVE') {
            if (!license.activatedAt) {
                license.activatedAt = license.usedAt || license.last_verified_at || license.created_at || new Date();
                needsUpdate = true;
            }
            if (!license.usedAt) {
                license.usedAt = license.activatedAt;
                needsUpdate = true;
            }
        }


        if (needsUpdate) {
            await license.save(); // Will trigger pre-save lifecycle validations
            updatedCount++;
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} licenses.`);
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
