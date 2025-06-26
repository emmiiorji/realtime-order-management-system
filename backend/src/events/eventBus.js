const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const redisConnection = require('../config/redis');
const EventStore = require('./eventStore');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.eventStore = new EventStore();
    this.subscribers = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.eventStore.initialize();
      await this.setupRedisSubscriptions();
      this.isInitialized = true;
      logger.info('EventBus initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EventBus:', error);
      throw error;
    }
  }

  async setupRedisSubscriptions() {
    const subscriber = redisConnection.getSubscriber();
    
    // Subscribe to all event channels
    await subscriber.subscribe('events:*', (message, channel) => {
      try {
        const event = JSON.parse(message);
        this.handleRedisEvent(event, channel);
      } catch (error) {
        logger.error('Error parsing Redis event:', error);
      }
    });

    logger.info('Redis event subscriptions set up');
  }

  handleRedisEvent(event, channel) {
    // Extract event type from channel
    const eventType = channel.replace('events:', '');
    
    // Emit the event locally
    this.emit(eventType, event);
    
    // Broadcast to WebSocket clients if available
    if (global.io) {
      global.io.emit('event', {
        type: eventType,
        data: event
      });
    }
  }

  async publish(eventType, data, metadata = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('EventBus not initialized');
      }

      const event = {
        id: uuidv4(),
        type: eventType,
        data,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'microservice'
        }
      };

      // Store event in event store
      await this.eventStore.saveEvent(event);

      // Publish to Redis for distribution
      const publisher = redisConnection.getPublisher();
      await publisher.publish(`events:${eventType}`, JSON.stringify(event));

      // Emit locally
      this.emit(eventType, event);

      logger.info(`Event published: ${eventType}`, { eventId: event.id });
      return event;
    } catch (error) {
      logger.error(`Failed to publish event ${eventType}:`, error);
      throw error;
    }
  }

  subscribe(eventType, handler, options = {}) {
    try {
      const subscriberId = uuidv4();
      
      // Store subscriber info
      this.subscribers.set(subscriberId, {
        eventType,
        handler,
        options,
        createdAt: new Date()
      });

      // Set up local event listener
      this.on(eventType, async (event) => {
        try {
          await handler(event);
        } catch (error) {
          logger.error(`Error in event handler for ${eventType}:`, error);
          
          // Optionally implement retry logic or dead letter queue
          if (options.retry) {
            this.handleRetry(event, handler, options);
          }
        }
      });

      logger.info(`Subscribed to event: ${eventType}`, { subscriberId });
      return subscriberId;
    } catch (error) {
      logger.error(`Failed to subscribe to event ${eventType}:`, error);
      throw error;
    }
  }

  unsubscribe(subscriberId) {
    try {
      const subscriber = this.subscribers.get(subscriberId);
      if (subscriber) {
        this.removeListener(subscriber.eventType, subscriber.handler);
        this.subscribers.delete(subscriberId);
        logger.info(`Unsubscribed from event: ${subscriber.eventType}`, { subscriberId });
      }
    } catch (error) {
      logger.error(`Failed to unsubscribe:`, error);
      throw error;
    }
  }

  async handleRetry(event, handler, options) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        await handler(event);
        logger.info(`Event handler succeeded on retry ${attempt}`, { eventId: event.id });
        return;
      } catch (error) {
        logger.warn(`Event handler failed on retry ${attempt}`, { 
          eventId: event.id, 
          attempt, 
          error: error.message 
        });
        
        if (attempt === maxRetries) {
          logger.error(`Event handler failed after ${maxRetries} retries`, { eventId: event.id });
          // Could send to dead letter queue here
        }
      }
    }
  }

  async getEventHistory(eventType, limit = 100) {
    try {
      return await this.eventStore.getEvents(eventType, limit);
    } catch (error) {
      logger.error(`Failed to get event history for ${eventType}:`, error);
      throw error;
    }
  }

  getSubscribers() {
    return Array.from(this.subscribers.entries()).map(([id, subscriber]) => ({
      id,
      eventType: subscriber.eventType,
      createdAt: subscriber.createdAt
    }));
  }

  async healthCheck() {
    try {
      const redisHealthy = redisConnection.getClient().isReady;
      const eventStoreHealthy = await this.eventStore.healthCheck();
      
      return {
        status: redisHealthy && eventStoreHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy,
        eventStore: eventStoreHealthy,
        subscribers: this.subscribers.size,
        initialized: this.isInitialized
      };
    } catch (error) {
      logger.error('EventBus health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = {
  EventBus,
  eventBus: new EventBus()
};
