const { EventBus } = require('../../events/eventBus');
const { USER_EVENTS, ORDER_EVENTS, INVENTORY_EVENTS } = require('../../events/eventTypes');

// Mock dependencies
jest.mock('../../config/logger');
jest.mock('../../events/eventStore');
jest.mock('../../config/redis', () => ({
  getSubscriber: jest.fn(() => ({
    subscribe: jest.fn(),
  })),
  getPublisher: jest.fn(() => ({
    publish: jest.fn(),
  })),
  getClient: jest.fn(() => ({
    isReady: true,
  })),
}));

describe('EventBus', () => {
  let eventBus;
  let mockEventStore;

  beforeEach(() => {
    // Reset the EventBus instance
    eventBus = new EventBus();
    
    // Mock EventStore
    mockEventStore = {
      initialize: jest.fn().mockResolvedValue(),
      saveEvent: jest.fn().mockResolvedValue(),
      healthCheck: jest.fn().mockResolvedValue(true),
    };
    
    eventBus.eventStore = mockEventStore;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await eventBus.initialize();
      
      expect(mockEventStore.initialize).toHaveBeenCalled();
      expect(eventBus.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockEventStore.initialize.mockRejectedValue(error);

      await expect(eventBus.initialize()).rejects.toThrow('Initialization failed');
      expect(eventBus.isInitialized).toBe(false);
    });
  });

  describe('event publishing', () => {
    beforeEach(async () => {
      await eventBus.initialize();
    });

    it('should publish an event successfully', async () => {
      const eventType = USER_EVENTS.USER_CREATED;
      const eventData = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const publishedEvent = await eventBus.publish(eventType, eventData);

      expect(publishedEvent).toMatchObject({
        type: eventType,
        data: eventData,
        metadata: expect.objectContaining({
          timestamp: expect.any(String),
          source: 'microservice',
        }),
      });

      expect(mockEventStore.saveEvent).toHaveBeenCalledWith(publishedEvent);
    });

    it('should generate unique event IDs', async () => {
      const eventType = USER_EVENTS.USER_CREATED;
      const eventData = { userId: 'user123' };

      const event1 = await eventBus.publish(eventType, eventData);
      const event2 = await eventBus.publish(eventType, eventData);

      expect(event1.id).not.toBe(event2.id);
    });

    it('should include custom metadata', async () => {
      const eventType = USER_EVENTS.USER_CREATED;
      const eventData = { userId: 'user123' };
      const customMetadata = {
        correlationId: 'corr123',
        userId: 'user123',
      };

      const publishedEvent = await eventBus.publish(eventType, eventData, customMetadata);

      expect(publishedEvent.metadata).toMatchObject(customMetadata);
    });

    it('should handle publishing errors', async () => {
      const error = new Error('Save failed');
      mockEventStore.saveEvent.mockRejectedValue(error);

      const eventType = USER_EVENTS.USER_CREATED;
      const eventData = { userId: 'user123' };

      await expect(eventBus.publish(eventType, eventData)).rejects.toThrow('Save failed');
    });

    it('should not publish when not initialized', async () => {
      const uninitializedEventBus = new EventBus();
      
      await expect(
        uninitializedEventBus.publish(USER_EVENTS.USER_CREATED, {})
      ).rejects.toThrow('EventBus not initialized');
    });
  });

  describe('event subscription', () => {
    beforeEach(async () => {
      await eventBus.initialize();
    });

    it('should subscribe to events successfully', () => {
      const handler = jest.fn();
      const eventType = USER_EVENTS.USER_CREATED;

      const subscriberId = eventBus.subscribe(eventType, handler);

      expect(subscriberId).toBeDefined();
      expect(typeof subscriberId).toBe('string');
      expect(eventBus.subscribers.has(subscriberId)).toBe(true);
    });

    it('should call event handlers when events are emitted', async () => {
      const handler = jest.fn();
      const eventType = USER_EVENTS.USER_CREATED;
      const eventData = { userId: 'user123' };

      eventBus.subscribe(eventType, handler);
      
      // Simulate event emission
      const event = {
        id: 'event123',
        type: eventType,
        data: eventData,
        metadata: { timestamp: new Date().toISOString() },
      };
      
      eventBus.emit(eventType, event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle multiple subscribers for the same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const eventType = USER_EVENTS.USER_CREATED;

      eventBus.subscribe(eventType, handler1);
      eventBus.subscribe(eventType, handler2);

      const event = {
        id: 'event123',
        type: eventType,
        data: { userId: 'user123' },
        metadata: { timestamp: new Date().toISOString() },
      };

      eventBus.emit(eventType, event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should unsubscribe successfully', () => {
      const handler = jest.fn();
      const eventType = USER_EVENTS.USER_CREATED;

      const subscriberId = eventBus.subscribe(eventType, handler);
      expect(eventBus.subscribers.has(subscriberId)).toBe(true);

      eventBus.unsubscribe(subscriberId);
      expect(eventBus.subscribers.has(subscriberId)).toBe(false);
    });

    it('should handle subscription errors gracefully', () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const eventType = USER_EVENTS.USER_CREATED;

      eventBus.subscribe(eventType, handler);

      const event = {
        id: 'event123',
        type: eventType,
        data: { userId: 'user123' },
        metadata: { timestamp: new Date().toISOString() },
      };

      // Should not throw, but handle error gracefully
      expect(() => eventBus.emit(eventType, event)).not.toThrow();
    });
  });

  describe('retry mechanism', () => {
    beforeEach(async () => {
      await eventBus.initialize();
    });

    it('should retry failed handlers', async () => {
      let callCount = 0;
      const handler = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Handler failed');
        }
      });

      const eventType = USER_EVENTS.USER_CREATED;
      const options = { retry: true, maxRetries: 3, retryDelay: 10 };

      eventBus.subscribe(eventType, handler, options);

      const event = {
        id: 'event123',
        type: eventType,
        data: { userId: 'user123' },
        metadata: { timestamp: new Date().toISOString() },
      };

      await eventBus.handleRetry(event, handler, options);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying after max attempts', async () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler always fails');
      });

      const eventType = USER_EVENTS.USER_CREATED;
      const options = { retry: true, maxRetries: 2, retryDelay: 10 };

      const event = {
        id: 'event123',
        type: eventType,
        data: { userId: 'user123' },
        metadata: { timestamp: new Date().toISOString() },
      };

      await eventBus.handleRetry(event, handler, options);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('health check', () => {
    it('should return healthy status when all components are working', async () => {
      await eventBus.initialize();
      
      // Mock Redis as healthy
      const mockRedisClient = { isReady: true };
      require('../../config/redis').getClient = jest.fn(() => mockRedisClient);

      const health = await eventBus.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.redis).toBe(true);
      expect(health.eventStore).toBe(true);
      expect(health.initialized).toBe(true);
    });

    it('should return unhealthy status when components are failing', async () => {
      await eventBus.initialize();
      
      // Mock Redis as unhealthy
      const mockRedisClient = { isReady: false };
      require('../../config/redis').getClient = jest.fn(() => mockRedisClient);
      
      // Mock EventStore as unhealthy
      mockEventStore.healthCheck.mockResolvedValue(false);

      const health = await eventBus.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.redis).toBe(false);
      expect(health.eventStore).toBe(false);
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockEventStore.healthCheck.mockRejectedValue(error);

      const health = await eventBus.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Health check failed');
    });
  });

  describe('event history', () => {
    beforeEach(async () => {
      await eventBus.initialize();
    });

    it('should retrieve event history', async () => {
      const mockEvents = [
        { id: 'event1', type: USER_EVENTS.USER_CREATED },
        { id: 'event2', type: USER_EVENTS.USER_UPDATED },
      ];

      mockEventStore.getEvents = jest.fn().mockResolvedValue(mockEvents);

      const events = await eventBus.getEventHistory(USER_EVENTS.USER_CREATED, 10);

      expect(mockEventStore.getEvents).toHaveBeenCalledWith(USER_EVENTS.USER_CREATED, 10);
      expect(events).toEqual(mockEvents);
    });

    it('should handle event history errors', async () => {
      const error = new Error('Failed to get events');
      mockEventStore.getEvents = jest.fn().mockRejectedValue(error);

      await expect(
        eventBus.getEventHistory(USER_EVENTS.USER_CREATED)
      ).rejects.toThrow('Failed to get events');
    });
  });

  describe('subscribers management', () => {
    beforeEach(async () => {
      await eventBus.initialize();
    });

    it('should return list of subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const id1 = eventBus.subscribe(USER_EVENTS.USER_CREATED, handler1);
      const id2 = eventBus.subscribe(USER_EVENTS.USER_UPDATED, handler2);

      const subscribers = eventBus.getSubscribers();

      expect(subscribers).toHaveLength(2);
      expect(subscribers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: id1,
            eventType: USER_EVENTS.USER_CREATED,
          }),
          expect.objectContaining({
            id: id2,
            eventType: USER_EVENTS.USER_UPDATED,
          }),
        ])
      );
    });
  });

  describe('Event Integration Tests', () => {
    it('should handle order creation event flow', async () => {
      await eventBus.initialize();

      const orderCreatedHandler = jest.fn().mockResolvedValue();
      const inventoryHandler = jest.fn().mockResolvedValue();

      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, orderCreatedHandler);
      eventBus.subscribe(INVENTORY_EVENTS.INVENTORY_UPDATED, inventoryHandler);

      // Publish order created event
      await eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'user-123',
        items: [
          { productId: 'prod-123', quantity: 2 }
        ],
        totalAmount: 20.00
      });

      // Simulate inventory update as a result of order creation
      await eventBus.publish(INVENTORY_EVENTS.INVENTORY_UPDATED, {
        productId: 'prod-123',
        quantity: -2,
        operation: 'order_created',
        reason: 'Order created: ORD-001'
      });

      expect(orderCreatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ORDER_EVENTS.ORDER_CREATED,
          data: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ORD-001'
          })
        })
      );

      expect(inventoryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: INVENTORY_EVENTS.INVENTORY_UPDATED,
          data: expect.objectContaining({
            productId: 'prod-123',
            quantity: -2,
            operation: 'order_created'
          })
        })
      );
    });

    it('should handle payment processing event flow', async () => {
      await eventBus.initialize();

      const paymentProcessedHandler = jest.fn().mockResolvedValue();
      const orderUpdatedHandler = jest.fn().mockResolvedValue();

      eventBus.subscribe(ORDER_EVENTS.ORDER_PAYMENT_PROCESSED, paymentProcessedHandler);
      eventBus.subscribe(ORDER_EVENTS.ORDER_UPDATED, orderUpdatedHandler);

      // Publish payment processed event
      await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_PROCESSED, {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        paymentAmount: 20.00,
        transactionId: 'txn-123'
      });

      // Simulate order status update as a result of payment
      await eventBus.publish(ORDER_EVENTS.ORDER_UPDATED, {
        orderId: 'order-123',
        status: 'confirmed',
        updatedFields: ['status', 'payment']
      });

      expect(paymentProcessedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ORDER_EVENTS.ORDER_PAYMENT_PROCESSED,
          data: expect.objectContaining({
            orderId: 'order-123',
            paymentAmount: 20.00,
            transactionId: 'txn-123'
          })
        })
      );

      expect(orderUpdatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ORDER_EVENTS.ORDER_UPDATED,
          data: expect.objectContaining({
            orderId: 'order-123',
            status: 'confirmed'
          })
        })
      );
    });

    it('should handle payment failure event flow', async () => {
      await eventBus.initialize();

      const paymentFailedHandler = jest.fn().mockResolvedValue();
      const inventoryRestoreHandler = jest.fn().mockResolvedValue();

      eventBus.subscribe(ORDER_EVENTS.ORDER_PAYMENT_FAILED, paymentFailedHandler);
      eventBus.subscribe(INVENTORY_EVENTS.INVENTORY_UPDATED, inventoryRestoreHandler);

      // Publish payment failed event
      await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_FAILED, {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        failureReason: 'Insufficient funds'
      });

      // Simulate inventory restoration as a result of payment failure
      await eventBus.publish(INVENTORY_EVENTS.INVENTORY_UPDATED, {
        productId: 'prod-123',
        quantity: 2, // Positive to restore
        operation: 'payment_failed',
        reason: 'Payment failed for order: ORD-001'
      });

      expect(paymentFailedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ORDER_EVENTS.ORDER_PAYMENT_FAILED,
          data: expect.objectContaining({
            orderId: 'order-123',
            failureReason: 'Insufficient funds'
          })
        })
      );

      expect(inventoryRestoreHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: INVENTORY_EVENTS.INVENTORY_UPDATED,
          data: expect.objectContaining({
            productId: 'prod-123',
            quantity: 2,
            operation: 'payment_failed'
          })
        })
      );
    });

    it('should handle event correlation and causation', async () => {
      await eventBus.initialize();

      const handler = jest.fn().mockResolvedValue();
      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler);

      const correlationId = 'corr-123';
      const causationId = 'cause-456';

      await eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
        orderId: 'order-123'
      }, {
        correlationId,
        causationId,
        userId: 'user-123'
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            correlationId,
            causationId,
            userId: 'user-123'
          })
        })
      );
    });

    it('should handle multiple subscribers for the same event', async () => {
      await eventBus.initialize();

      const handler1 = jest.fn().mockResolvedValue();
      const handler2 = jest.fn().mockResolvedValue();
      const handler3 = jest.fn().mockResolvedValue();

      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler1);
      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler2);
      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler3);

      await eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
        orderId: 'order-123'
      });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should handle event publishing with retries on failure', async () => {
      await eventBus.initialize();

      const failingHandler = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce();

      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, failingHandler, { retry: true });

      // First attempt should fail, but event should be retried
      await eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
        orderId: 'order-123'
      });

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Handler should be called twice (initial + retry)
      expect(failingHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Performance Tests', () => {
    it('should handle high volume of events', async () => {
      await eventBus.initialize();

      const handler = jest.fn().mockResolvedValue();
      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler);

      const eventCount = 100;
      const promises = [];

      for (let i = 0; i < eventCount; i++) {
        promises.push(
          eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
            orderId: `order-${i}`,
            orderNumber: `ORD-${i.toString().padStart(3, '0')}`
          })
        );
      }

      await Promise.all(promises);

      expect(handler).toHaveBeenCalledTimes(eventCount);
      expect(mockEventStore.saveEvent).toHaveBeenCalledTimes(eventCount);
    });

    it('should handle concurrent event publishing', async () => {
      await eventBus.initialize();

      const handler = jest.fn().mockResolvedValue();
      eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, handler);

      const concurrentEvents = [
        eventBus.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 'order-1' }),
        eventBus.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 'order-2' }),
        eventBus.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 'order-3' }),
        eventBus.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 'order-4' }),
        eventBus.publish(ORDER_EVENTS.ORDER_CREATED, { orderId: 'order-5' })
      ];

      await Promise.all(concurrentEvents);

      expect(handler).toHaveBeenCalledTimes(5);
      expect(mockEventStore.saveEvent).toHaveBeenCalledTimes(5);
    });
  });
});
