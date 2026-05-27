const mongoose = require('mongoose');

const calendarSyncLogSchema = new mongoose.Schema({
    workspace_id: { type: String, required: true },
    provider: { type: String, required: true },
    country: { type: String, required: true },
    region: { type: String },
    year: { type: Number, required: true },
    holidays_found: { type: Number, required: true },
    holidays_imported: { type: Number, required: true },
    status: { type: String, required: true },
    error_message: { type: String },
    previous_hash: { type: String },
    hash: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

calendarSyncLogSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
    }
});

module.exports = mongoose.model('CalendarSyncLog', calendarSyncLogSchema);
