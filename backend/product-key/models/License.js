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
      "AVAILABLE",
      "ACTIVE",
      "REVOKED"
    ],
    default: "AVAILABLE"
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
  activatedAt: {
    type: Date
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

// Enforce lifecycle constraints
function validateLifecycle(doc) {
  if (doc.status === 'AVAILABLE') {
    if (doc.isUsed) throw new Error('Invalid State: AVAILABLE license cannot be isUsed=true');
    if (doc.activatedAt || doc.usedAt || doc.last_verified_at || doc.workspaceId || doc.usedBy || (doc.activated_devices && doc.activated_devices.length > 0)) {
      throw new Error('Invalid State: AVAILABLE license cannot have activation timestamps or usage metadata');
    }
  } else if (doc.status === 'ACTIVE') {
    if (!doc.isUsed) throw new Error('Invalid State: ACTIVE license must have isUsed=true');
    if (!doc.activatedAt || !doc.usedAt) {
      throw new Error('Invalid State: ACTIVE license must have activatedAt and usedAt');
    }
  } else if (doc.status === 'REVOKED') {
    if (doc.isUsed) throw new Error('Invalid State: REVOKED license must have isUsed=false');
  }
}

licenseSchema.pre('save', function (next) {
  try {
    if (this.status === 'AVAILABLE' || this.status === 'REVOKED') {
      this.isUsed = false;
    } else if (this.status === 'ACTIVE') {
      this.isUsed = true;
    }
    
    validateLifecycle(this);
    next();
  } catch (err) {
    next(err);
  }
});

licenseSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();
  
  const setOp = update.$set || update;
  if (setOp.status) {
    if (setOp.status === 'AVAILABLE' || setOp.status === 'REVOKED') {
      setOp.isUsed = false;
    } else if (setOp.status === 'ACTIVE') {
      setOp.isUsed = true;
    }
  }

  // We apply the update to the current document state to validate it
  // But mongoose middleware for findOneAndUpdate doesn't easily expose the current doc.
  // To keep it simple, we just validate the $set fields if they attempt to create contradictory states directly
  if (setOp.status === 'AVAILABLE' && (setOp.isUsed === true || setOp.activatedAt || setOp.usedAt)) {
    return next(new Error('Invalid State: Cannot update to AVAILABLE with active usage fields'));
  }
  if (setOp.status === 'ACTIVE' && setOp.isUsed === false) {
    return next(new Error('Invalid State: Cannot update to ACTIVE with isUsed=false'));
  }
  if (setOp.status === 'REVOKED' && setOp.isUsed === true) {
    return next(new Error('Invalid State: Cannot update to REVOKED with isUsed=true'));
  }
  next();
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