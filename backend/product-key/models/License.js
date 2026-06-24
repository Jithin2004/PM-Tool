const mongoose = require('mongoose');
const geoip = require("geoip-lite");

const licenseSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: [
      "ACTIVE",
      "CONSUMED",
      "EXPIRED",
      "REVOKED"
    ]
  },
  plan: {
    type: String,
    enum: ['STARTER', 'BUSINESS', 'ENTERPRISE'],
    default: 'BUSINESS',
    required: true
  },
  activation_limit: {
    type: Number,
    default: 1, // Enforce single-use logically if desired, keeping for compatibility
    required: true
  },
  // Replaced activated_workspace_id with explicit single-use flags
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  usedBy: {
    type: String
  },
  workspaceId: {
    type: String
  },
  activation_metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
  last_verified_at: {
    type: Date
  },
  purchase_metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  activation: {
    ip: {
      type: String
    },

    country: {
      type: String
    },

    region: {
      type: String
    },

    city: {
      type: String
    },

    timezone: {
      type: String
    },

    userAgent: {
      type: String
    },

    source: {
      type: String,
      default: "web"
    }
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