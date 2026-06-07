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
    ] 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true 
  },
  reason: { 
    type: String 
  },
  device_hash: { 
    type: String 
  },
  license_key: { 
    type: String,
    required: true 
  }
});

// Strip MongoDB metadata for safety
const stripSecrets = (doc, ret) => {
  delete ret._id;
  delete ret.__v;
  return ret;
};
auditEventSchema.set('toJSON', { transform: stripSecrets, virtuals: false, versionKey: false });
auditEventSchema.set('toObject', { transform: stripSecrets, virtuals: false, versionKey: false });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
