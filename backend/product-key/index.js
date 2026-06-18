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
    res.status(200).json({ status: 'ok', service: 'resolve-pm-backend', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Public Licensing Endpoints ──
app.post('/verify', licenseController.verifyLicense);

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
        console.error(`[DB] MongoDB Connection Error: ${dbErr.message}`);
    }
});