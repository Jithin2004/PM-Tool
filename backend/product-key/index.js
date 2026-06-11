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
// ── Inline Public Licensing Endpoints with Fail-Safe Header Guards ──
app.get('/verify', (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // If testing directly in a browser tab without a token, send a clean 401 JSON immediately
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            valid: false, 
            message: 'Missing or invalid authorization token. Direct browser access is not supported.' 
        });
    }
    // If a token is present, pass it safely to the controller
    return licenseController.verifyLicense(req, res, next);
});

app.post('/activate', licenseController.activateLicense);
app.get('/addLicense', licenseController.addLicense);

// App Startup Process
app.listen(PORT, async () => {
    try {
        await connectDB();
        console.log(`License server is running securely on port ${PORT}`);
    } catch (dbErr) {
        console.error('[FATAL] MongoDB initialization failed during bootstrap:', dbErr.message);
    }
});