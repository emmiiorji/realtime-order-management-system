const express = require('express');
const eventController = require('../controllers/eventController');
const { validatePagination, validateDateRange } = require('../middleware/validation');

const router = express.Router();

// Event monitoring and debugging routes
router.get('/health', eventController.getEventSystemHealth);
router.get('/stats', eventController.getEventStats);
router.get('/subscribers', eventController.getSubscribers);

// Event history and querying
router.get('/', validatePagination, eventController.getAllEvents);
router.get('/types/:eventType', validatePagination, eventController.getEventsByType);
router.get('/correlation/:correlationId', eventController.getEventsByCorrelation);
router.get('/date-range', validateDateRange, eventController.getEventsByDateRange);
router.get('/:eventId', eventController.getEvent);

// Event publishing (for testing)
router.post('/publish', eventController.publishEvent);

// Event replay (admin only)
router.post('/:eventId/replay', eventController.replayEvent);

module.exports = router;
