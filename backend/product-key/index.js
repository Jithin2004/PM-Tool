require('dotenv').config()
const express = require('express')
const connectDB = require('./config/db')

const app = express()
const PORT = process.env.PORT || 5000

// Hardened startup environment variable checks
const requiredEnv = ['JWT_SECRET', 'LICENSE_SECRET'];
const missingEnv = requiredEnv.filter(name => !process.env[name]);
if (missingEnv.length > 0) {
    console.error(`[FATAL] Required environment variables missing: ${missingEnv.join(', ')}. Exiting...`);
    process.exit(1);
}
const dbUri = process.env.MONGO_URI || process.env.DB;
if (!dbUri) {
    console.error('[FATAL] Database connection URI missing (MONGO_URI or DB). Exiting...');
    process.exit(1);
}

// ... env checks and database configurations ...

const cors = require('cors');
app.use(cors());
app.use(express.json());

// Remove the external file require line and pull the controller directly
const licenseController = require('./controller/license');

// Register the /verify endpoint directly on the main app instance
app.get('/verify', licenseController.verifyLicense);
app.post('/activate', licenseController.activateLicense);
app.get('/addLicense', licenseController.addLicense);

// Base health endpoints serve as fallbacks below
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'welcome to pm-tool license server'
    });
});

app.get('/test', (req, res) => {
    res.status(200).json({
        message: 'test route success backend running successfully'
    });
});