const redis = require('redis');
const logger = require('./logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
  }

  async connect() {
    try {
      // Support both REDIS_URL (from Render managed Redis) and individual config
      let redisConfig;

      if (process.env.REDIS_URL) {
        // Use REDIS_URL if provided (Render managed Redis)
        redisConfig = {
          url: process.env.REDIS_URL,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        };
      } else {
        // Use individual Redis configuration
        redisConfig = {
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
          password: process.env.REDIS_PASSWORD || undefined,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        };
      }

      // Main client for general operations
      this.client = redis.createClient(redisConfig);
      
      // Separate clients for pub/sub
      this.subscriber = redis.createClient(redisConfig);
      this.publisher = redis.createClient(redisConfig);

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      // Set up error handlers
      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
      });

      this.subscriber.on('error', (error) => {
        logger.error('Redis subscriber error:', error);
      });

      this.publisher.on('error', (error) => {
        logger.error('Redis publisher error:', error);
      });

      logger.info('Connected to Redis successfully');
      
      return {
        client: this.client,
        subscriber: this.subscriber,
        publisher: this.publisher
      };
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      const disconnectPromises = [];
      
      if (this.client) {
        disconnectPromises.push(this.client.disconnect());
      }
      
      if (this.subscriber) {
        disconnectPromises.push(this.subscriber.disconnect());
      }
      
      if (this.publisher) {
        disconnectPromises.push(this.publisher.disconnect());
      }

      await Promise.all(disconnectPromises);
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  getSubscriber() {
    return this.subscriber;
  }

  getPublisher() {
    return this.publisher;
  }
}

module.exports = new RedisConnection();
