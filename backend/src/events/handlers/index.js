const UserEventHandlers = require('./userEventHandlers');
const OrderEventHandlers = require('./orderEventHandlers');
const logger = require('../../config/logger');

class EventHandlerManager {
  constructor() {
    this.handlers = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing event handlers...');

      // Initialize all event handlers
      this.handlers.push(new UserEventHandlers());
      this.handlers.push(new OrderEventHandlers());

      this.isInitialized = true;
      logger.info(`Event handlers initialized successfully. Total handlers: ${this.handlers.length}`);
    } catch (error) {
      logger.error('Failed to initialize event handlers:', error);
      throw error;
    }
  }

  getHandlerCount() {
    return this.handlers.length;
  }

  isReady() {
    return this.isInitialized;
  }
}

// Create singleton instance
const eventHandlerManager = new EventHandlerManager();

module.exports = eventHandlerManager;
