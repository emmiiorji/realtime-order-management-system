const mongoose = require('mongoose');
const logger = require('../config/logger');

// Event schema for MongoDB
const eventSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  metadata: {
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    source: {
      type: String,
      required: true
    },
    version: {
      type: String,
      default: '1.0.0'
    },
    correlationId: String,
    causationId: String,
    userId: String
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  processingErrors: [{
    error: String,
    timestamp: Date,
    retryCount: Number
  }]
}, {
  timestamps: true,
  collection: 'events'
});

// Indexes for better query performance
eventSchema.index({ type: 1, 'metadata.timestamp': -1 });
eventSchema.index({ 'metadata.correlationId': 1 });
eventSchema.index({ processed: 1, 'metadata.timestamp': 1 });

class EventStore {
  constructor() {
    this.Event = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.Event = mongoose.model('Event', eventSchema);
      this.isInitialized = true;
      logger.info('EventStore initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EventStore:', error);
      throw error;
    }
  }

  async saveEvent(event) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const eventDoc = new this.Event({
        id: event.id,
        type: event.type,
        data: event.data,
        metadata: {
          ...event.metadata,
          timestamp: new Date(event.metadata.timestamp)
        }
      });

      await eventDoc.save();
      logger.debug(`Event saved to store: ${event.type}`, { eventId: event.id });
      
      return eventDoc;
    } catch (error) {
      logger.error(`Failed to save event to store:`, error);
      throw error;
    }
  }

  async getEvent(eventId) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const event = await this.Event.findOne({ id: eventId });
      return event;
    } catch (error) {
      logger.error(`Failed to get event ${eventId}:`, error);
      throw error;
    }
  }

  async getEvents(eventType = null, limit = 100, offset = 0) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const query = eventType ? { type: eventType } : {};
      
      const events = await this.Event
        .find(query)
        .sort({ 'metadata.timestamp': -1 })
        .limit(limit)
        .skip(offset)
        .lean();

      return events;
    } catch (error) {
      logger.error(`Failed to get events:`, error);
      throw error;
    }
  }

  async getEventsByCorrelationId(correlationId) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const events = await this.Event
        .find({ 'metadata.correlationId': correlationId })
        .sort({ 'metadata.timestamp': 1 })
        .lean();

      return events;
    } catch (error) {
      logger.error(`Failed to get events by correlation ID ${correlationId}:`, error);
      throw error;
    }
  }

  async getEventsByDateRange(startDate, endDate, eventType = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const query = {
        'metadata.timestamp': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (eventType) {
        query.type = eventType;
      }

      const events = await this.Event
        .find(query)
        .sort({ 'metadata.timestamp': -1 })
        .lean();

      return events;
    } catch (error) {
      logger.error(`Failed to get events by date range:`, error);
      throw error;
    }
  }

  async markEventAsProcessed(eventId) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      await this.Event.updateOne(
        { id: eventId },
        { $set: { processed: true } }
      );

      logger.debug(`Event marked as processed: ${eventId}`);
    } catch (error) {
      logger.error(`Failed to mark event as processed ${eventId}:`, error);
      throw error;
    }
  }

  async addProcessingError(eventId, error) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      await this.Event.updateOne(
        { id: eventId },
        {
          $push: {
            processingErrors: {
              error: error.message || error,
              timestamp: new Date(),
              retryCount: 1
            }
          }
        }
      );

      logger.debug(`Processing error added for event: ${eventId}`);
    } catch (error) {
      logger.error(`Failed to add processing error for event ${eventId}:`, error);
      throw error;
    }
  }

  async getUnprocessedEvents(limit = 100) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const events = await this.Event
        .find({ processed: false })
        .sort({ 'metadata.timestamp': 1 })
        .limit(limit)
        .lean();

      return events;
    } catch (error) {
      logger.error(`Failed to get unprocessed events:`, error);
      throw error;
    }
  }

  async getEventStats() {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const stats = await this.Event.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            processed: { $sum: { $cond: ['$processed', 1, 0] } },
            unprocessed: { $sum: { $cond: ['$processed', 0, 1] } },
            lastEvent: { $max: '$metadata.timestamp' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalEvents = await this.Event.countDocuments();
      const totalProcessed = await this.Event.countDocuments({ processed: true });

      return {
        totalEvents,
        totalProcessed,
        totalUnprocessed: totalEvents - totalProcessed,
        eventTypes: stats
      };
    } catch (error) {
      logger.error(`Failed to get event stats:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Try to perform a simple query
      await this.Event.findOne().limit(1);
      return true;
    } catch (error) {
      logger.error('EventStore health check failed:', error);
      return false;
    }
  }

  async cleanup(olderThanDays = 30) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventStore not initialized');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.Event.deleteMany({
        'metadata.timestamp': { $lt: cutoffDate },
        processed: true
      });

      logger.info(`Cleaned up ${result.deletedCount} old events`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Failed to cleanup old events:`, error);
      throw error;
    }
  }
}

module.exports = EventStore;
