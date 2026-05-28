const mongoose = require('mongoose');

const userIntegrationSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Number },
    googleCalendarId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('UserIntegration', userIntegrationSchema);
