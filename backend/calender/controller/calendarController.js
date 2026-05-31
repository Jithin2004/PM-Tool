const { google } = require('googleapis');
const UserIntegration = require('../models/UserIntegration');
const CalendarEvent = require('../models/CalendarEvent');
const CalendarSyncLog = require('../models/CalendarSyncLog');

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI || 'http://localhost:5001/api/calendar/oauth2callback';
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

const SCOPES = ['https://www.googleapis.com/auth/calendar.app.created'];

exports.googleAuth = async (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        state: req.user.id
    });
    res.redirect(authUrl);
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

        let integration = await UserIntegration.findOne({ userId });
        let googlePersonalCalendarId = integration ? integration.googlePersonalCalendarId : null;
        let googleOrgCalendarId = integration ? integration.googleOrgCalendarId : null;

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        if (!googlePersonalCalendarId) {
            const newCal = await calendar.calendars.insert({
                requestBody: { summary: `pm-tool-personal-schedules-${userId}` }
            });
            googlePersonalCalendarId = newCal.data.id;
        }
        if (!googleOrgCalendarId) {
            const orgCal = await calendar.calendars.insert({
                requestBody: { summary: 'pm-tool-organization-schedules' }
            });
            googleOrgCalendarId = orgCal.data.id;
        }

        const updateData = {
            googleAccessToken: tokens.access_token,
            googleTokenExpiry: tokens.expiry_date,
            googlePersonalCalendarId,
            googleOrgCalendarId
        };
        if (tokens.refresh_token) {
            updateData.googleRefreshToken = tokens.refresh_token;
        }

        await UserIntegration.findOneAndUpdate(
            { userId },
            updateData,
            { upsert: true, new: true }
        );

        // Return success script to close window or redirect
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Calendar Connected</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f4f6; color: #1f2937; }
                    .card { text-align: center; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); max-width: 400px; width: 90%; }
                    h1 { margin-top: 0; font-size: 1.5rem; color: #10b981; }
                    p { color: #6b7280; margin-bottom: 0; }
                    svg { width: 64px; height: 64px; margin-bottom: 1rem; fill: #10b981; }
                </style>
            </head>
            <body>
                <div class="card">
                    <svg viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <h1>Successfully Connected!</h1>
                    <p>Your Google Calendar is now integrated. This window will close automatically.</p>
                </div>
                <script>
                    window.opener?.postMessage("google_calendar_connected", "*");
                    setTimeout(() => window.close(), 3000);
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Failed</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f4f6; color: #1f2937; }
                    .card { text-align: center; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); max-width: 400px; width: 90%; }
                    h1 { margin-top: 0; font-size: 1.5rem; color: #ef4444; }
                    p { color: #6b7280; margin-bottom: 0; }
                    svg { width: 64px; height: 64px; margin-bottom: 1rem; fill: #ef4444; }
                </style>
            </head>
            <body>
                <div class="card">
                    <svg viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                    <h1>Authentication Failed</h1>
                    <p>There was an error connecting your calendar. Please close this window and try again.</p>
                </div>
            </body>
            </html>
        `);
    }
};

const getOAuthClientForUser = async (userId) => {
    if (!userId) return { client: null, googlePersonalCalendarId: null, googleOrgCalendarId: null };
    const integration = await UserIntegration.findOne({ userId });
    if (!integration || !integration.googleRefreshToken || !integration.googlePersonalCalendarId || !integration.googleOrgCalendarId) {
        return { client: null, googlePersonalCalendarId: null, googleOrgCalendarId: null };
    }

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

    return { 
        client, 
        googlePersonalCalendarId: integration.googlePersonalCalendarId,
        googleOrgCalendarId: integration.googleOrgCalendarId
    };
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
            ev.id = ev.id || (e._id ? e._id.toString() : '');
            return ev;
        });

        const { client, googlePersonalCalendarId } = await getOAuthClientForUser(req.user.id);
        if (client && googlePersonalCalendarId) {
            const calendar = google.calendar({ version: 'v3', auth: client });
            const googleEvents = await calendar.events.list({
                calendarId: googlePersonalCalendarId,
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
        res.status(500).json({ error: error.message || 'Failed to fetch events' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const event = new CalendarEvent({ ...req.body });
        // Use a deterministic Google event ID based on Mongoose ObjectId
        const googleEventId = "pmtool" + event._id.toString();
        event.google_event_id = googleEventId;
        await event.save();

        const isCompanyEvent = req.body.event_type === 'company' || req.body.event_type === 'organization';

        if (isCompanyEvent && req.body.start_date && req.body.end_date) {
            // Fan-out to all organization schedules
            const users = await UserIntegration.find({ googleOrgCalendarId: { $ne: null } });
            await Promise.all(users.map(async (u) => {
                if (!u.googleRefreshToken) return;
                const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
                oAuth2Client.setCredentials({ 
                    access_token: u.googleAccessToken, 
                    refresh_token: u.googleRefreshToken,
                    expiry_date: u.googleTokenExpiry
                });
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                await calendar.events.insert({
                    calendarId: u.googleOrgCalendarId,
                    requestBody: {
                        id: googleEventId,
                        summary: req.body.title,
                        description: req.body.description,
                        start: { dateTime: new Date(req.body.start_date).toISOString() },
                        end: { dateTime: new Date(req.body.end_date).toISOString() },
                    }
                }).catch(e => console.error("Google org insert error for user:", u.userId, e));
            }));
        } else if (req.body.start_date && req.body.end_date) {
            // Personal event
            const { client, googlePersonalCalendarId } = await getOAuthClientForUser(req.user.id);
            if (client && googlePersonalCalendarId) {
                const calendar = google.calendar({ version: 'v3', auth: client });
                await calendar.events.insert({
                    calendarId: googlePersonalCalendarId,
                    requestBody: {
                        id: googleEventId,
                        summary: req.body.title,
                        description: req.body.description,
                        start: { dateTime: new Date(req.body.start_date).toISOString() },
                        end: { dateTime: new Date(req.body.end_date).toISOString() },
                    }
                }).catch(e => console.error("Google personal insert error:", e));
            }
        }

        const responseEvent = event.toJSON();
        responseEvent.id = responseEvent.id || responseEvent._id.toString();
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

        if (updated.google_event_id) {
            const isCompanyEvent = updated.event_type === 'company' || updated.event_type === 'organization';

            if (isCompanyEvent) {
                // Fan-out to all organization schedules
                const users = await UserIntegration.find({ googleOrgCalendarId: { $ne: null } });
                await Promise.all(users.map(async (u) => {
                    if (!u.googleRefreshToken) return;
                    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
                    oAuth2Client.setCredentials({ 
                        access_token: u.googleAccessToken, 
                        refresh_token: u.googleRefreshToken,
                        expiry_date: u.googleTokenExpiry
                    });
                    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                    await calendar.events.update({
                        calendarId: u.googleOrgCalendarId,
                        eventId: updated.google_event_id,
                        requestBody: {
                            summary: updated.title,
                            description: updated.description,
                            start: { dateTime: new Date(updated.start_date).toISOString() },
                            end: { dateTime: new Date(updated.end_date).toISOString() },
                        }
                    }).catch(e => console.error("Google org update error for user:", u.userId, e));
                }));
            } else {
                // Personal event update
                const { client, googlePersonalCalendarId } = await getOAuthClientForUser(req.user.id);
                if (client && googlePersonalCalendarId) {
                    const calendar = google.calendar({ version: 'v3', auth: client });
                    await calendar.events.update({
                        calendarId: googlePersonalCalendarId,
                        eventId: updated.google_event_id,
                        requestBody: {
                            summary: updated.title,
                            description: updated.description,
                            start: { dateTime: new Date(updated.start_date).toISOString() },
                            end: { dateTime: new Date(updated.end_date).toISOString() },
                        }
                    }).catch(e => console.error("Google personal update error:", e));
                }
            }
        }

        const responseEvent = updated.toJSON();
        responseEvent.id = responseEvent.id || responseEvent._id.toString();
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

        await CalendarEvent.findByIdAndUpdate(id, { deleted_at: new Date() });

        if (existing.google_event_id) {
            const isCompanyEvent = existing.event_type === 'company' || existing.event_type === 'organization';

            if (isCompanyEvent) {
                // Fan-out delete to all organization schedules
                const users = await UserIntegration.find({ googleOrgCalendarId: { $ne: null } });
                await Promise.all(users.map(async (u) => {
                    if (!u.googleRefreshToken) return;
                    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
                    oAuth2Client.setCredentials({ 
                        access_token: u.googleAccessToken, 
                        refresh_token: u.googleRefreshToken,
                        expiry_date: u.googleTokenExpiry
                    });
                    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                    await calendar.events.delete({
                        calendarId: u.googleOrgCalendarId,
                        eventId: existing.google_event_id
                    }).catch(e => console.error("Google org delete error for user:", u.userId, e));
                }));
            } else {
                // Personal event delete
                const { client, googlePersonalCalendarId } = await getOAuthClientForUser(req.user.id);
                if (client && googlePersonalCalendarId) {
                    const calendar = google.calendar({ version: 'v3', auth: client });
                    await calendar.events.delete({
                        calendarId: googlePersonalCalendarId,
                        eventId: existing.google_event_id
                    }).catch(e => console.error("Google personal delete error:", e));
                }
            }
        }

        res.json({ success: true });
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
            let googleEventId = null;
            const { client, googleCalendarId } = await getOAuthClientForUser(req.user.id);
            if (client && googleCalendarId && req.body.start_date && req.body.end_date) {
                const calendar = google.calendar({ version: 'v3', auth: client });
                const gEvent = await calendar.events.insert({
                    calendarId: googleCalendarId,
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
