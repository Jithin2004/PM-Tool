require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const licenseController = require('./controller/license');

const app = express();
const PORT = process.env.PORT || 10000;

// Global Core Middlewares
app.use(cors());
app.use(express.json());

// Health Check Endpoint (for Render and Docker healthchecks)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public Licensing Endpoints with Authorization Guard ──
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
let isDbConnected = false;

app.listen(PORT, async () => {
    console.log(`[SERVER] License server starting on port ${PORT}...`);
    try {
        await connectDB();
        isDbConnected = true;
        console.log('[SERVER] ✓ License server ready (port ' + PORT + ')');
    } catch (dbErr) {
        console.error('[FATAL] MongoDB initialization failed during bootstrap:', dbErr.message);
        process.exit(1);
    }
});