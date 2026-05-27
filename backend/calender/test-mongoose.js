const mongoose = require('mongoose');
const CalendarEvent = require('./models/CalendarEvent');
async function test() {
    const e = new CalendarEvent({ workspace_id: 'test', event_type: 'test', title: 'test', start_date: new Date(), end_date: new Date() });
    const j = e.toJSON();
    console.log(j);
    console.log('id:', j.id);
    console.log('_id:', j._id);
}
test();
