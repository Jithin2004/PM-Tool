require('dotenv').config();
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const License = require('./models/License');

async function runTests() {
    console.log('--- License Lifecycle Validation Proof ---');
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    try {
        console.log('Test 1: Create valid AVAILABLE license');
        const l1 = new License({ key: 'L1', status: 'AVAILABLE', plan: 'BUSINESS' });
        await l1.save();
        console.log('✅ Success: AVAILABLE license created');

        console.log('\nTest 2: Try to create AVAILABLE license with activatedAt (Should Fail)');
        try {
            const l2 = new License({ key: 'L2', status: 'AVAILABLE', plan: 'BUSINESS', activatedAt: new Date() });
            await l2.save();
            console.error('❌ Failed: Should not allow activatedAt on AVAILABLE');
        } catch (e) {
            console.log(`✅ Success: Caught error -> ${e.message}`);
        }

        console.log('\nTest 3: Try to transition to ACTIVE without isUsed=true (Should Fail)');
        try {
            l1.status = 'ACTIVE';
            await l1.save();
            console.error('❌ Failed: Should not allow ACTIVE without isUsed=true');
        } catch (e) {
            console.log(`✅ Success: Caught error -> ${e.message}`);
        }

        console.log('\nTest 4: Try to transition to ACTIVE with isUsed=true but no timestamps (Should Fail)');
        try {
            l1.status = 'ACTIVE';
            l1.isUsed = true;
            await l1.save();
            console.error('❌ Failed: Should not allow ACTIVE without timestamps');
        } catch (e) {
            console.log(`✅ Success: Caught error -> ${e.message}`);
        }

        console.log('\nTest 5: Valid transition to ACTIVE with all fields');
        l1.status = 'ACTIVE';
        l1.isUsed = true;
        l1.activatedAt = new Date();
        l1.usedAt = new Date();
        await l1.save();
        console.log('✅ Success: ACTIVE license saved correctly');

        console.log('\nTest 6: Valid reset back to AVAILABLE');
        l1.status = 'AVAILABLE';
        l1.isUsed = false;
        l1.activatedAt = undefined;
        l1.usedAt = undefined;
        await l1.save();
        console.log('✅ Success: RESET license saved correctly');
        
        console.log('\nTest 7: Valid REVOKED state');
        const l3 = new License({ key: 'L3', status: 'REVOKED', plan: 'BUSINESS', isUsed: false });
        await l3.save();
        console.log('✅ Success: REVOKED license saved correctly');

    } finally {
        await mongoose.disconnect();
        await mongoServer.stop();
    }
}

runTests().catch(console.error);
