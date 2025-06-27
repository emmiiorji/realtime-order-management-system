const express = require('express');
const eventController = require('../controllers/eventController');
const { validatePagination, validateDateRange } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /events/health:
 *   get:
 *     summary: Get event system health status
 *     tags: [Events]
 *     description: Check the health and status of the event bus and event store
 *     responses:
 *       200:
 *         description: Event system is healthy
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         health:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, unhealthy]
 *                             eventBus:
 *                               type: object
 *                             eventStore:
 *                               type: object
 *       503:
 *         description: Event system is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         health:
 *                           type: object
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/health', eventController.getEventSystemHealth);

/**
 * @swagger
 * /events/stats:
 *   get:
 *     summary: Get event system statistics
 *     tags: [Events]
 *     description: Retrieve comprehensive statistics about events in the system
 *     responses:
 *       200:
 *         description: Event statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         stats:
 *                           type: object
 *                           properties:
 *                             totalEvents:
 *                               type: integer
 *                               description: Total number of events in the system
 *                             eventsByType:
 *                               type: object
 *                               description: Count of events grouped by type
 *                             eventsByStatus:
 *                               type: object
 *                               description: Count of events grouped by processing status
 *                             recentEvents:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Event'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/stats', eventController.getEventStats);

/**
 * @swagger
 * /events/subscribers:
 *   get:
 *     summary: Get active event subscribers
 *     tags: [Events]
 *     description: Retrieve list of all active event subscribers and their handlers
 *     responses:
 *       200:
 *         description: Subscribers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of active subscribers
 *                     data:
 *                       type: object
 *                       properties:
 *                         subscribers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               eventType:
 *                                 type: string
 *                                 description: Type of event this subscriber handles
 *                               handler:
 *                                 type: string
 *                                 description: Name of the handler function
 *                               isActive:
 *                                 type: boolean
 *                                 description: Whether the subscriber is currently active
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/subscribers', eventController.getSubscribers);

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Get all events with pagination
 *     tags: [Events]
 *     description: Retrieve all events from the event store with pagination support
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of events per page
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of events returned
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                     data:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Event'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', validatePagination, eventController.getAllEvents);

/**
 * @swagger
 * /events/types/{eventType}:
 *   get:
 *     summary: Get events by type
 *     tags: [Events]
 *     description: Retrieve all events of a specific type with pagination
 *     parameters:
 *       - in: path
 *         name: eventType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user.created, user.updated, user.deleted, user.login, user.logout, order.created, order.updated, order.cancelled, order.completed, order.payment.processed, order.payment.failed, order.shipped, order.delivered, system.startup, system.shutdown, system.error, system.health.check, notification.email.sent, notification.sms.sent, notification.push.sent, notification.failed, inventory.updated, inventory.low.stock, inventory.out.of.stock, inventory.restocked]
 *         description: Type of events to retrieve
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of events per page
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of events returned
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                     data:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Event'
 *                         eventType:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/types/:eventType', validatePagination, eventController.getEventsByType);

/**
 * @swagger
 * /events/correlation/{correlationId}:
 *   get:
 *     summary: Get events by correlation ID
 *     tags: [Events]
 *     description: Retrieve all events that share the same correlation ID (related events)
 *     parameters:
 *       - in: path
 *         name: correlationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Correlation ID to search for
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of events returned
 *                     data:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Event'
 *                         correlationId:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/correlation/:correlationId', eventController.getEventsByCorrelation);

/**
 * @swagger
 * /events/date-range:
 *   get:
 *     summary: Get events by date range
 *     tags: [Events]
 *     description: Retrieve events within a specific date range with optional event type filtering
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for the range (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for the range (ISO 8601 format)
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [user.created, user.updated, user.deleted, user.login, user.logout, order.created, order.updated, order.cancelled, order.completed, order.payment.processed, order.payment.failed, order.shipped, order.delivered, system.startup, system.shutdown, system.error, system.health.check, notification.email.sent, notification.sms.sent, notification.push.sent, notification.failed, inventory.updated, inventory.low.stock, inventory.out.of.stock, inventory.restocked]
 *         description: Optional event type filter
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of events returned
 *                     data:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Event'
 *                         dateRange:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date-time
 *                             endDate:
 *                               type: string
 *                               format: date-time
 *                             eventType:
 *                               type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/date-range', validateDateRange, eventController.getEventsByDateRange);

/**
 * @swagger
 * /events/{eventId}:
 *   get:
 *     summary: Get a specific event by ID
 *     tags: [Events]
 *     description: Retrieve a single event by its unique identifier
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the event
 *     responses:
 *       200:
 *         description: Event retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         event:
 *                           $ref: '#/components/schemas/Event'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:eventId', eventController.getEvent);

/**
 * @swagger
 * /events/publish:
 *   post:
 *     summary: Publish a new event (for testing)
 *     tags: [Events]
 *     description: Manually publish an event to the event bus for testing purposes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventType, data]
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [user.created, user.updated, user.deleted, user.login, user.logout, order.created, order.updated, order.cancelled, order.completed, order.payment.processed, order.payment.failed, order.shipped, order.delivered, system.startup, system.shutdown, system.error, system.health.check, notification.email.sent, notification.sms.sent, notification.push.sent, notification.failed, inventory.updated, inventory.low.stock, inventory.out.of.stock, inventory.restocked]
 *                 description: Type of event to publish
 *               data:
 *                 type: object
 *                 description: Event payload data (structure depends on event type)
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for the event
 *                 properties:
 *                   source:
 *                     type: string
 *                   version:
 *                     type: string
 *                   priority:
 *                     type: integer
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       201:
 *         description: Event published successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Event published successfully
 *                     data:
 *                       type: object
 *                       properties:
 *                         event:
 *                           $ref: '#/components/schemas/Event'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/publish', eventController.publishEvent);

/**
 * @swagger
 * /events/{eventId}/replay:
 *   post:
 *     summary: Replay a specific event (Admin only)
 *     tags: [Events]
 *     description: Replay an existing event by creating a new event with the same data but updated metadata
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the event to replay
 *     responses:
 *       200:
 *         description: Event replayed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Event replayed successfully
 *                     data:
 *                       type: object
 *                       properties:
 *                         originalEvent:
 *                           $ref: '#/components/schemas/Event'
 *                         replayedEvent:
 *                           $ref: '#/components/schemas/Event'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:eventId/replay', eventController.replayEvent);

/**
 * @swagger
 * /events/debug/unprocessed:
 *   get:
 *     summary: Get unprocessed events (for debugging)
 *     tags: [Events]
 *     description: Retrieve events that have not been processed yet (debugging endpoint)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of unprocessed events to retrieve
 *     responses:
 *       200:
 *         description: Unprocessed events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: integer
 *                       description: Number of unprocessed events returned
 *                     data:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Event'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/debug/unprocessed', eventController.getUnprocessedEvents);

/**
 * @swagger
 * /events/debug/{eventId}/mark-processed:
 *   post:
 *     summary: Mark event as processed (for debugging)
 *     tags: [Events]
 *     description: Manually mark an event as processed (debugging endpoint)
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the event to mark as processed
 *     responses:
 *       200:
 *         description: Event marked as processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Event marked as processed
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/debug/:eventId/mark-processed', eventController.markEventAsProcessed);

module.exports = router;
