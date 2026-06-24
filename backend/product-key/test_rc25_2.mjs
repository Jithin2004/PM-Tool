import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'REVOKED'], default: 'ACTIVE', required: true },
  plan: { type: String, enum: ['STARTER', 'BUSINESS', 'ENTERPRISE'], default: 'BUSINESS', required: true },
  activation_limit: { type: Number, default: 1, required: true },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  usedBy: { type: String },
  workspaceId: { type: String },
  activation_metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  activated_devices: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now, required: true },
  last_verified_at: { type: Date },
  purchase_metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
});

const License = mongoose.model('License', licenseSchema);

const BASE_URL = 'http://localhost:5002'; // Local API since Render is down

async function run() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');
    
    // 1. Create a fresh key
    const productKey = `RC25-TEST-${Math.floor(Math.random() * 1000000)}`;
    const newLicense = await License.create({
        key: productKey,
        plan: 'ENTERPRISE',
        activation_limit: 1,
        isUsed: false,
        status: 'ACTIVE'
    });

    console.log('\n==== 1. MONGO DOCUMENT BEFORE TEST ====');
    console.log(JSON.stringify(newLicense.toJSON(), null, 2));

    const workspaceId = `ws_${Math.floor(Math.random() * 1000)}`;
    const userIdentifier = 'test_user_id';

    // 2. First Activation Test
    console.log('\n==== 2. FIRST ACTIVATION TEST ====');
    const act1 = await fetch(`${BASE_URL}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey, workspaceId, userIdentifier })
    });
    const act1Result = await act1.json();
    console.log('Activation 1 Result:', act1Result);

    const docAfter1 = await License.findOne({ key: productKey });
    console.log('\nMONGO DOCUMENT AFTER ACTIVATION:');
    console.log(JSON.stringify(docAfter1.toJSON(), null, 2));

    // 3. Reuse Attack Test
    console.log('\n==== 3. REUSE ATTACK TEST ====');
    const act2 = await fetch(`${BASE_URL}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey, workspaceId: 'another_ws_id', userIdentifier: 'hacker' })
    });
    const act2Result = await act2.json();
    console.log('Reuse Attempt Result:', act2Result);

    // 4. Concurrent Activation Test
    console.log('\n==== 4. CONCURRENT ACTIVATION TEST ====');
    const productKeyConcurrent = `RC25-CONCURRENT-${Math.floor(Math.random() * 1000000)}`;
    await License.create({
        key: productKeyConcurrent,
        plan: 'ENTERPRISE',
        activation_limit: 1,
        isUsed: false,
        status: 'ACTIVE'
    });

    const concurrentRequests = [
        fetch(`${BASE_URL}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productKey: productKeyConcurrent, workspaceId: 'wsA', userIdentifier: 'userA' })
        }),
        fetch(`${BASE_URL}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productKey: productKeyConcurrent, workspaceId: 'wsB', userIdentifier: 'userB' })
        })
    ];

    const results = await Promise.all(concurrentRequests);
    const json1 = await results[0].json();
    const json2 = await results[1].json();
    console.log('Concurrent Response 1:', json1);
    console.log('Concurrent Response 2:', json2);

    // 5. Verify Endpoint Audit
    console.log('\n==== 5. VERIFY ENDPOINT AUDIT ====');
    const verifyResp = await fetch(`${BASE_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey })
    });
    const verifyJson = await verifyResp.json();
    console.log('Verify Used Key Result:', verifyJson);

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
