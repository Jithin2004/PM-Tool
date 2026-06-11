const CalendarEvent = require('../models/CalendarEvent');
const CalendarSyncLog = require('../models/CalendarSyncLog');

exports.getEventsInRange = async (req, res) => {
    const { workspace_id, start_date, end_date } = req.query;
    if (!workspace_id) return res.status(400).json({ error: "Missing workspace_id" });

    try {
        const query = { workspace_id, deleted_at: null };
        if (start_date) query.end_date = { $gte: new Date(start_date) };
        if (end_date) query.start_date = { $lte: new Date(end_date) };

        const localEvents = await CalendarEvent.find(query);
        let allEvents = localEvents.map(e => {
            const ev = e.toJSON();
            // ensure id is string
            ev.id = ev.id || (e._id ? e._id.toString() : '');
            return ev;
        });

        res.json(allEvents);
    } catch (error) {
        console.error('getEventsInRange Error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch events' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const event = new CalendarEvent({ ...req.body });
        await event.save();
        const responseEvent = event.toJSON();
        // id is populated by Mongoose virtuals
        res.json(responseEvent);
    } catch (error) {
        console.error('createEvent Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create event' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await CalendarEvent.findById(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const updated = await CalendarEvent.findByIdAndUpdate(id, { ...req.body, updated_at: new Date() }, { new: true });

        const responseEvent = updated.toJSON();
        // id is populated by Mongoose virtuals
        res.json(responseEvent);
    } catch (error) {
        console.error('updateEvent Error:', error);
        res.status(500).json({ error: error.message || 'Failed to update event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await CalendarEvent.findById(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        existing.deleted_at = new Date();
        await existing.save();

        const responseEvent = existing.toJSON();
        // id is populated by Mongoose virtuals
        res.json(responseEvent);
    } catch (error) {
        console.error('deleteEvent Error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete event' });
    }
};

exports.upsertBySourceKey = async (req, res) => {
    try {
        const { workspace_id, source_table, source_id } = req.body;
        if (!workspace_id || !source_table || !source_id) {
            return res.status(400).json({ error: 'Missing keys' });
        }

        let existing = await CalendarEvent.findOne({ workspace_id, source_table, source_id }).sort({ deleted_at: 1, created_at: -1 });

        if (existing) {
            const updated = await CalendarEvent.findByIdAndUpdate(existing._id, { ...req.body, deleted_at: null, updated_at: new Date() }, { new: true });
            const responseEvent = updated.toJSON();
            // id is populated by Mongoose virtuals
            return res.json({ event: responseEvent, created: false });
        } else {
            const event = new CalendarEvent({ ...req.body });
            await event.save();
            const responseEvent = event.toJSON();
            // id is populated by Mongoose virtuals
            return res.json({ event: responseEvent, created: true });
        }
    } catch (error) {
        console.error('upsertBySourceKey Error:', error);
        res.status(500).json({ error: error.message || 'Failed to upsert event' });
    }
};

exports.getSyncLogs = async (req, res) => {
    try {
        const { workspace_id, limit, year } = req.query;
        if (!workspace_id) return res.status(400).json({ error: "Missing workspace_id" });
        const query = { workspace_id };
        if (year) query.year = parseInt(year, 10);
        const logs = await CalendarSyncLog.find(query).sort({ created_at: -1 }).limit(parseInt(limit, 10) || 20);
        res.json(logs);
    } catch (error) {
        console.error('getSyncLogs Error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch sync logs' });
    }
};

exports.appendSyncLog = async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id) return res.status(400).json({ error: "Missing workspace_id" });
        const log = new CalendarSyncLog(req.body);
        await log.save();
        res.json(log);
    } catch (error) {
        console.error('appendSyncLog Error:', error);
        res.status(500).json({ error: error.message || 'Failed to append sync log' });
    }
};
