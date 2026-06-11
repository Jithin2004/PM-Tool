const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  event_type: { 
    type: String, 
    required: true, 
    enum: [
      'license_created', 
      'license_activated', 
      'license_revoked', 
      'verification_failed', 
      'activation_limit_reached'
    ],
    index: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true,
    index: true
  },
  reason: { 
    type: String 
  },
  device_hash: { 
    type: String,
    index: true
  },
  license_key: { 
    type: String,
    required: true,
    index: true
  }
});

// Compound index for common query patterns (license_key + timestamp DESC)
auditEventSchema.index({ license_key: 1, timestamp: -1 });

// Strip MongoDB metadata for safety
const stripSecrets = (doc, ret) => {
  delete ret._id;
  delete ret.__v;
  return ret;
};
auditEventSchema.set('toJSON', { transform: stripSecrets, virtuals: false, versionKey: false });
auditEventSchema.set('toObject', { transform: stripSecrets, virtuals: false, versionKey: false });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
