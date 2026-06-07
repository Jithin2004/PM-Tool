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

const cors = require('cors');
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'welcome to pm-tool license server'
    })
})

const licenseRoute = require('./routes/licenseRoute')
app.use("/", licenseRoute)

app.get('/test', (req, res) => {
    res.status(200).json({
        message: 'test route success backend running successfully'
    })
})

app.listen(PORT, async () => {
    await connectDB()
    console.log(`License server is running on port ${PORT}`)
})