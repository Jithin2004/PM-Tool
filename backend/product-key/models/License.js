const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'EXPIRED', 'REVOKED'], 
    default: 'ACTIVE',
    required: true 
  },
  plan: { 
    type: String, 
    enum: ['STARTER', 'BUSINESS', 'ENTERPRISE'], 
    default: 'BUSINESS',
    required: true 
  },
  activation_limit: { 
    type: Number, 
    default: 3,
    required: true 
  },
  activated_devices: { 
    type: [String], 
    default: [] 
  },
  created_at: { 
    type: Date, 
    default: Date.now,
    required: true 
  },
  activated_at: { 
    type: Date 
  },
  last_verified_at: { 
    type: Date 
  },
  purchase_metadata: { 
    type: Map, 
    of: mongoose.Schema.Types.Mixed,
    default: {} 
  }
});

// Enforce security stripping of internal fields when converting to JSON/Object
const stripSecrets = (doc, ret) => {
  delete ret._id;
  delete ret.__v;
  return ret;
};
licenseSchema.set('toJSON', { transform: stripSecrets, virtuals: false, versionKey: false });
licenseSchema.set('toObject', { transform: stripSecrets, virtuals: false, versionKey: false });

module.exports = mongoose.model('License', licenseSchema);