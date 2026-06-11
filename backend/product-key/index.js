require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const licenseController = require('./controller/license');

const app = express();
const PORT = process.env.PORT || 10000;

// Dynamic database selection safety fallback
const dbUri = process.env.MONGO_URI || process.env.DB;
if (!dbUri) {
    console.error('[FATAL] Database connection URI missing (MONGO_URI or DB). Exiting...');
    process.exit(1);
}

// Global Core Middlewares
app.use(cors());
app.use(express.json());

// ── Inline Public Licensing Endpoints (Guarantees mapping resolution) ──
app.get('/verify', licenseController.verifyLicense);
app.post('/activate', licenseController.activateLicense);
app.get('/addLicense', licenseController.addLicense);

// Base Health Fallback Encodings
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

// App Startup Process
app.listen(PORT, async () => {
    try {
        await connectDB();
        console.log(`License server is running securely on port ${PORT}`);
    } catch (dbErr) {
        console.error('[FATAL] MongoDB initialization failed during bootstrap:', dbErr.message);
    }
});