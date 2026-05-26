const express = require('express');
const router = express.Router();
const calendarController = require('../controller/calendarController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/auth/google', calendarController.googleAuth);
router.get('/oauth2callback', calendarController.googleAuthCallback);
router.get('/events', calendarController.getEventsInRange);
router.post('/events', calendarController.createEvent);
router.put('/events/:id', calendarController.updateEvent);
router.delete('/events/:id', calendarController.deleteEvent);
router.post('/events/upsert', calendarController.upsertBySourceKey);

module.exports = router;
