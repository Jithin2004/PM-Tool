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

async function run() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');
    
    const key = `RC25-TEST-${Math.floor(Math.random() * 1000000)}`;
    const newLicense = await License.create({
        key,
        plan: 'ENTERPRISE',
        activation_limit: 1,
        isUsed: false,
        status: 'ACTIVE'
    });

    console.log('==== MONGO DOCUMENT BEFORE TEST ====');
    console.log(JSON.stringify(newLicense.toJSON(), null, 2));
    
    // Save the key to a temp file for the next test script to pick up
    import('fs').then(fs => fs.writeFileSync('scratch_rc25_key.txt', key));

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
