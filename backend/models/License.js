// models/LicenseKey.js
const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  isUsed: { type: Boolean, default: false },
  activatedAt: { type: Date },
  // Optional: tie it to a user account
  activatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
});

module.exports = mongoose.model('License', licenseSchema);