const { AppError, catchAsync } = require('../middleware/errorHandler');
const eventBus = require('../events/eventBus');
const EventStore = require('../events/eventStore');
const { validateEventData, createEventMetadata, ALL_EVENTS } = require('../events/eventTypes');
const logger = require('../config/logger');

const eventStore = new EventStore();

// Get event system health
exports.getEventSystemHealth = catchAsync(async (req, res, next) => {
  const health = await eventBus.healthCheck();

  res.status(health.status === 'healthy' ? 200 : 503).json({
    status: 'success',
    data: {
      health
    }
  });
});

// Get event statistics
exports.getEventStats = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const stats = await eventStore.getEventStats();

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

// Get active subscribers
exports.getSubscribers = catchAsync(async (req, res, next) => {
  const subscribers = eventBus.getSubscribers();

  res.status(200).json({
    status: 'success',
    results: subscribers.length,
    data: {
      subscribers
    }
  });
});

// Get all events with pagination
exports.getAllEvents = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const events = await eventStore.getEvents(null, limit, offset);

  res.status(200).json({
    status: 'success',
    results: events.length,
    pagination: {
      page,
      limit,
      hasMore: events.length === limit
    },
    data: {
      events
    }
  });
});

// Get events by type
exports.getEventsByType = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { eventType } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Validate event type
  if (!Object.values(ALL_EVENTS).includes(eventType)) {
    return next(new AppError('Invalid event type', 400));
  }

  const events = await eventStore.getEvents(eventType, limit, offset);

  res.status(200).json({
    status: 'success',
    results: events.length,
    pagination: {
      page,
      limit,
      hasMore: events.length === limit
    },
    data: {
      events,
      eventType
    }
  });
});

// Get events by correlation ID
exports.getEventsByCorrelation = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { correlationId } = req.params;

  if (!correlationId) {
    return next(new AppError('Correlation ID is required', 400));
  }

  const events = await eventStore.getEventsByCorrelationId(correlationId);

  res.status(200).json({
    status: 'success',
    results: events.length,
    data: {
      events,
      correlationId
    }
  });
});

// Get events by date range
exports.getEventsByDateRange = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { startDate, endDate, eventType } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError('Start date and end date are required', 400));
  }

  const events = await eventStore.getEventsByDateRange(startDate, endDate, eventType);

  res.status(200).json({
    status: 'success',
    results: events.length,
    data: {
      events,
      dateRange: {
        startDate,
        endDate,
        eventType
      }
    }
  });
});

// Get single event
exports.getEvent = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { eventId } = req.params;

  const event = await eventStore.getEvent(eventId);

  if (!event) {
    return next(new AppError('Event not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      event
    }
  });
});

// Publish event (for testing)
exports.publishEvent = catchAsync(async (req, res, next) => {
  const { eventType, data, metadata = {} } = req.body;

  if (!eventType || !data) {
    return next(new AppError('Event type and data are required', 400));
  }

  // Validate event type
  if (!Object.values(ALL_EVENTS).includes(eventType)) {
    return next(new AppError('Invalid event type', 400));
  }

  // Validate event data
  const validation = validateEventData(eventType, data);
  if (!validation.valid) {
    return next(new AppError(`Invalid event data: ${validation.errors.join(', ')}`, 400));
  }

  // Create metadata
  const eventMetadata = createEventMetadata({
    ...metadata,
    source: 'api',
    correlationId: req.headers['x-correlation-id'],
    userId: req.headers['x-user-id']
  });

  try {
    const event = await eventBus.publish(eventType, data, eventMetadata);

    logger.info(`Event published via API: ${eventType}`, { 
      eventId: event.id,
      publishedBy: req.headers['x-user-id'] || 'anonymous'
    });

    res.status(201).json({
      status: 'success',
      message: 'Event published successfully',
      data: {
        event
      }
    });
  } catch (error) {
    logger.error(`Failed to publish event via API: ${eventType}`, error);
    return next(new AppError('Failed to publish event', 500));
  }
});

// Replay event (admin only)
exports.replayEvent = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { eventId } = req.params;
  const replayedBy = req.headers['x-user-id'] || 'admin';

  // Get the original event
  const originalEvent = await eventStore.getEvent(eventId);

  if (!originalEvent) {
    return next(new AppError('Event not found', 404));
  }

  try {
    // Create a new event with replay metadata
    const replayMetadata = createEventMetadata({
      ...originalEvent.metadata,
      source: 'replay',
      correlationId: originalEvent.metadata.correlationId,
      causationId: originalEvent.id,
      userId: replayedBy,
      originalEventId: originalEvent.id,
      replayedAt: new Date().toISOString(),
      replayedBy
    });

    const replayedEvent = await eventBus.publish(
      originalEvent.type,
      originalEvent.data,
      replayMetadata
    );

    logger.info(`Event replayed: ${originalEvent.type}`, { 
      originalEventId: originalEvent.id,
      replayedEventId: replayedEvent.id,
      replayedBy 
    });

    res.status(200).json({
      status: 'success',
      message: 'Event replayed successfully',
      data: {
        originalEvent,
        replayedEvent
      }
    });
  } catch (error) {
    logger.error(`Failed to replay event: ${eventId}`, error);
    return next(new AppError('Failed to replay event', 500));
  }
});

// Get unprocessed events (for debugging)
exports.getUnprocessedEvents = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const limit = parseInt(req.query.limit) || 100;
  const events = await eventStore.getUnprocessedEvents(limit);

  res.status(200).json({
    status: 'success',
    results: events.length,
    data: {
      events
    }
  });
});

// Mark event as processed (for debugging)
exports.markEventAsProcessed = catchAsync(async (req, res, next) => {
  if (!eventStore.isInitialized) {
    await eventStore.initialize();
  }

  const { eventId } = req.params;

  await eventStore.markEventAsProcessed(eventId);

  logger.info(`Event marked as processed: ${eventId}`, { 
    markedBy: req.headers['x-user-id'] || 'admin'
  });

  res.status(200).json({
    status: 'success',
    message: 'Event marked as processed'
  });
});
