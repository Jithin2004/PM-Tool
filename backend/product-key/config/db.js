const mongoose = require('mongoose');

async function connectDB() {
    try {
        mongoose.set('bufferCommands', false);
        // Support multiple env var names: MONGO_URI (standard), DB (legacy), DATABASE_URL (Render default)
        const dbUri = process.env.MONGO_URI || process.env.DB || process.env.DATABASE_URL;
        
        if (!dbUri) {
            throw new Error('No database URI provided. Set MONGO_URI, DB, or DATABASE_URL.');
        }

        // Validate MongoDB URI format
        if (!dbUri.startsWith('mongodb')) {
            throw new Error(`Invalid database URI format: ${dbUri.substring(0, 50)}... Expected MongoDB URI (mongodb://... or mongodb+srv://...)`);
        }

        console.log('[DB] Connecting to MongoDB:', dbUri.substring(0, 50) + '...');
        
        // Connect with timeout (5 seconds)
        await Promise.race([
            mongoose.connect(dbUri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
                socketTimeoutMS: 5000,
                retryWrites: true,
                w: 'majority'
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database connection timeout (5s)')), 5000)
            )
        ]);
        
        console.log('[DB] MongoDB Connected Successfully!');
    } catch (err) {
        console.error(`[DB] MongoDB Connection Error: ${err.message}`);
    // process.exit(1);
    }
}

module.exports = connectDB;