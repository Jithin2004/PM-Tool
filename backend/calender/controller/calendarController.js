const { google } = require('googleapis');
const UserIntegration = require('../models/UserIntegration');
const CalendarEvent = require('../models/CalendarEvent');

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'http://localhost:5001/api/calendar/oauth2callback';
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

exports.googleAuth = async (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: req.user.id
    });
    res.json({ authUrl });
};

exports.googleAuthCallback = async (req, res) => {
    const code = req.query.code;
    const userId = req.query.state;
    if (!code || !userId) {
        return res.status(400).send('Missing code or state');
    }
    
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        await UserIntegration.findOneAndUpdate(
            { userId },
            { 
                googleAccessToken: tokens.access_token, 
                googleRefreshToken: tokens.refresh_token,
                googleTokenExpiry: tokens.expiry_date
            },
            { upsert: true, new: true }
        );
        
        // Return success script to close window or redirect
        res.send(`
            <html><body>
            <script>
                window.opener.postMessage("google_calendar_connected", "*");
                window.close();
            </script>
            Calendar connected! You can close this window.
            </body></html>
        `);
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Auth Failed');
    }
};

const getOAuthClientForUser = async (userId) => {
    if (!userId) return null;
    const integration = await UserIntegration.findOne({ userId });
    if (!integration || !integration.googleRefreshToken) return null;
    
    const client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
    client.setCredentials({
        access_token: integration.googleAccessToken,
        refresh_token: integration.googleRefreshToken,
        expiry_date: integration.googleTokenExpiry
    });
    
    client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
            integration.googleRefreshToken = tokens.refresh_token;
        }
        integration.googleAccessToken = tokens.access_token;
        integration.googleTokenExpiry = tokens.expiry_date;
        await integration.save();
    });
    
    return client;
};

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
            ev.id = ev.id || ev._id.toString();
            return ev;
        });
        
        const client = await getOAuthClientForUser(req.user.id);
        if (client) {
            const calendar = google.calendar({ version: 'v3', auth: client });
            const googleEvents = await calendar.events.list({
                calendarId: 'primary',
                timeMin: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
                timeMax: end_date ? new Date(end_date).toISOString() : undefined,
                singleEvents: true,
                orderBy: 'startTime',
            }).catch(e => { console.error("Google list error:", e); return null; });
            
            if (googleEvents && googleEvents.data && googleEvents.data.items) {
                const gEvents = googleEvents.data.items.map(item => ({
                    id: `google-${item.id}`,
                    workspace_id,
                    event_type: 'meeting',
                    title: item.summary || 'Google Event',
                    description: item.description,
                    start_date: item.start?.dateTime || item.start?.date,
                    end_date: item.end?.dateTime || item.end?.date,
                    capacity_impact: 1,
                    is_recurring: false,
                    timezone: item.start?.timeZone || 'UTC',
                    auto_generated: false,
                    source_id: item.id,
                    source_table: 'google_calendar',
                    google_event_id: item.id
                }));
                
                const existingGoogleIds = new Set(allEvents.map(e => e.google_event_id).filter(Boolean));
                const filteredGEvents = gEvents.filter(ge => !existingGoogleIds.has(ge.google_event_id));
                
                allEvents = [...allEvents, ...filteredGEvents];
            }
        }
        
        res.json(allEvents);
    } catch (error) {
        console.error('getEventsInRange Error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const client = await getOAuthClientForUser(req.user.id);
        let googleEventId = null;
        
        if (client && req.body.start_date && req.body.end_date) {
            const calendar = google.calendar({ version: 'v3', auth: client });
            const gEvent = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: req.body.title,
                    description: req.body.description,
                    start: { dateTime: new Date(req.body.start_date).toISOString() },
                    end: { dateTime: new Date(req.body.end_date).toISOString() },
                }
            }).catch(e => console.error("Google insert error:", e));
            if (gEvent && gEvent.data) googleEventId = gEvent.data.id;
        }
        
        const event = new CalendarEvent({ ...req.body, google_event_id: googleEventId });
        await event.save();
        const responseEvent = event.toJSON();
        responseEvent.id = responseEvent._id.toString();
        res.json(responseEvent);
    } catch (error) {
        console.error('createEvent Error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await CalendarEvent.findById(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        
        const updated = await CalendarEvent.findByIdAndUpdate(id, { ...req.body, updated_at: new Date() }, { new: true });
        
        if (updated.google_event_id) {
            const client = await getOAuthClientForUser(req.user.id);
            if (client) {
                const calendar = google.calendar({ version: 'v3', auth: client });
                await calendar.events.update({
                    calendarId: 'primary',
                    eventId: updated.google_event_id,
                    requestBody: {
                        summary: updated.title,
                        description: updated.description,
                        start: { dateTime: new Date(updated.start_date).toISOString() },
                        end: { dateTime: new Date(updated.end_date).toISOString() },
                    }
                }).catch(e => console.error("Google update error:", e));
            }
        }
        
        const responseEvent = updated.toJSON();
        responseEvent.id = responseEvent._id.toString();
        res.json(responseEvent);
    } catch (error) {
        console.error('updateEvent Error:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await CalendarEvent.findById(id);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        
        existing.deleted_at = new Date();
        await existing.save();
        
        if (existing.google_event_id) {
            const client = await getOAuthClientForUser(req.user.id);
            if (client) {
                const calendar = google.calendar({ version: 'v3', auth: client });
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: existing.google_event_id
                }).catch(e => console.error("Google delete error:", e));
            }
        }
        
        const responseEvent = existing.toJSON();
        responseEvent.id = responseEvent._id.toString();
        res.json(responseEvent);
    } catch (error) {
        console.error('deleteEvent Error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
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
            responseEvent.id = responseEvent._id.toString();
            return res.json({ event: responseEvent, created: false });
        } else {
            let googleEventId = null;
            const client = await getOAuthClientForUser(req.user.id);
            if (client && req.body.start_date && req.body.end_date) {
                const calendar = google.calendar({ version: 'v3', auth: client });
                const gEvent = await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: {
                        summary: req.body.title,
                        description: req.body.description,
                        start: { dateTime: new Date(req.body.start_date).toISOString() },
                        end: { dateTime: new Date(req.body.end_date).toISOString() },
                    }
                }).catch(e => console.error("Google insert error:", e));
                if (gEvent && gEvent.data) googleEventId = gEvent.data.id;
            }
            
            const event = new CalendarEvent({ ...req.body, google_event_id: googleEventId });
            await event.save();
            const responseEvent = event.toJSON();
            responseEvent.id = responseEvent._id.toString();
            return res.json({ event: responseEvent, created: true });
        }
    } catch (error) {
        console.error('upsertBySourceKey Error:', error);
        res.status(500).json({ error: 'Failed to upsert event' });
    }
};
