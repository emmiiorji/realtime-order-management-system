// Mock the EventBus before importing OrderEventHandlers
jest.mock('../../events/eventBus', () => ({
  eventBus: {
    publish: jest.fn(),
    subscribe: jest.fn(),
    initialize: jest.fn()
  }
}));

const OrderEventHandlers = require('../../events/handlers/orderEventHandlers');
const { eventBus } = require('../../events/eventBus');
const Order = require('../../models/Order');

// Additional mocks

jest.mock('../../models/Order', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('OrderEventHandlers', () => {
  let orderEventHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    // Now we can create the instance normally since eventBus is properly mocked
    orderEventHandlers = new OrderEventHandlers();
  });

  describe('handleOrderCreated', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'user-123',
        items: [
          {
            productId: 'prod-123',
            quantity: 2,
            unitPrice: 10.00
          }
        ],
        totalAmount: 20.00,
        paymentMethod: 'stripe'
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should handle order created event successfully', async () => {
      // Mock all the handler methods
      orderEventHandlers.sendOrderConfirmation = jest.fn().mockResolvedValue();
      orderEventHandlers.updateInventory = jest.fn().mockResolvedValue();
      orderEventHandlers.processPayment = jest.fn().mockResolvedValue();
      orderEventHandlers.createOrderAnalytics = jest.fn().mockResolvedValue();
      orderEventHandlers.notifyFulfillmentCenter = jest.fn().mockResolvedValue();

      await orderEventHandlers.handleOrderCreated(mockEvent);

      expect(orderEventHandlers.sendOrderConfirmation).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.updateInventory).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.processPayment).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.createOrderAnalytics).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.notifyFulfillmentCenter).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle errors in order created event', async () => {
      orderEventHandlers.sendOrderConfirmation = jest.fn().mockRejectedValue(new Error('Email service error'));

      await expect(orderEventHandlers.handleOrderCreated(mockEvent)).rejects.toThrow('Email service error');
    });
  });

  describe('handlePaymentProcessed', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        paymentAmount: 20.00,
        transactionId: 'txn-123'
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should handle payment processed event successfully', async () => {
      orderEventHandlers.sendPaymentConfirmation = jest.fn().mockResolvedValue();
      orderEventHandlers.updateOrderStatusAfterPayment = jest.fn().mockResolvedValue();
      orderEventHandlers.recordFinancialAnalytics = jest.fn().mockResolvedValue();

      await orderEventHandlers.handlePaymentProcessed(mockEvent);

      expect(orderEventHandlers.sendPaymentConfirmation).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.updateOrderStatusAfterPayment).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.recordFinancialAnalytics).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('handlePaymentFailed', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        failureReason: 'Insufficient funds'
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should handle payment failed event successfully', async () => {
      orderEventHandlers.sendPaymentFailureNotification = jest.fn().mockResolvedValue();
      orderEventHandlers.updateOrderStatusAfterPaymentFailure = jest.fn().mockResolvedValue();
      orderEventHandlers.restoreInventoryAfterPaymentFailure = jest.fn().mockResolvedValue();

      await orderEventHandlers.handlePaymentFailed(mockEvent);

      expect(orderEventHandlers.sendPaymentFailureNotification).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.updateOrderStatusAfterPaymentFailure).toHaveBeenCalledWith(mockEvent);
      expect(orderEventHandlers.restoreInventoryAfterPaymentFailure).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('updateInventory', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderNumber: 'ORD-001',
        userId: 'user-123',
        items: [
          {
            productId: 'prod-123',
            quantity: 2
          },
          {
            productId: 'prod-456',
            quantity: 1
          }
        ]
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should publish inventory update events for all items', async () => {
      eventBus.publish.mockResolvedValue();

      await orderEventHandlers.updateInventory(mockEvent);

      expect(eventBus.publish).toHaveBeenCalledTimes(2);

      expect(eventBus.publish).toHaveBeenNthCalledWith(1,
        'inventory.updated',
        {
          productId: 'prod-123',
          quantity: -2,
          operation: 'order_created',
          reason: 'Order created: ORD-001'
        },
        {
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        }
      );

      expect(eventBus.publish).toHaveBeenNthCalledWith(2,
        'inventory.updated',
        {
          productId: 'prod-456',
          quantity: -1,
          operation: 'order_created',
          reason: 'Order created: ORD-001'
        },
        {
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        }
      );
    });
  });

  describe('processPayment', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        totalAmount: 20.00,
        paymentMethod: 'stripe',
        userId: 'user-123'
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should publish payment processed event on successful payment', async () => {
      // Mock successful payment (80% success rate in the original code)
      Math.random = jest.fn().mockReturnValue(0.5); // Less than 0.8, so success
      eventBus.publish.mockResolvedValue();

      await orderEventHandlers.processPayment(mockEvent);

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.payment.processed',
        expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'ORD-001',
          paymentAmount: 20.00,
          paymentMethod: 'stripe',
          transactionId: expect.stringMatching(/^txn_\d+$/),
          processedAt: expect.any(String)
        }),
        {
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        }
      );
    });

    it('should publish payment failed event on failed payment', async () => {
      // Mock failed payment
      Math.random = jest.fn().mockReturnValue(0.9); // Greater than 0.8, so failure
      eventBus.publish.mockResolvedValue();

      await orderEventHandlers.processPayment(mockEvent);

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.payment.failed',
        expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'ORD-001',
          paymentAmount: 20.00,
          paymentMethod: 'stripe',
          failureReason: 'Insufficient funds',
          failedAt: expect.any(String)
        }),
        {
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        }
      );
    });
  });

  describe('sendOrderConfirmation', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'user-123',
        items: [
          { productId: 'prod-123', quantity: 1, unitPrice: 10 }
        ],
        totalAmount: 10
      },
      metadata: {
        correlationId: 'corr-123',
        timestamp: '2025-06-27T02:58:00.000Z'
      }
    };

    it('should publish order confirmation email event', async () => {
      eventBus.publish.mockResolvedValue();

      await orderEventHandlers.sendOrderConfirmation(mockEvent);

      expect(eventBus.publish).toHaveBeenCalledWith(
        'notification.email.sent',
        expect.objectContaining({
          userId: 'user-123',
          subject: 'Order Confirmation - ORD-001',
          template: 'order_confirmation',
          data: expect.objectContaining({
            orderNumber: 'ORD-001',
            items: expect.any(Array),
            totalAmount: 10,
            orderDate: '2025-06-27T02:58:00.000Z'
          }),
          priority: 'high'
        }),
        expect.objectContaining({
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        })
      );
    });
  });

  describe('updateOrderStatusAfterPayment', () => {
    const mockEvent = {
      data: {
        orderId: 'order-123'
      }
    };

    it('should log order status update', async () => {
      const logger = require('../../config/logger');

      await orderEventHandlers.updateOrderStatusAfterPayment(mockEvent);

      expect(logger.debug).toHaveBeenCalledWith(
        'Order status updated after payment',
        { orderId: 'order-123' }
      );
    });
  });

  describe('recordFinancialAnalytics', () => {
    const mockEvent = {
      data: {
        orderId: 'order-123',
        paymentAmount: 20.00
      },
      metadata: {
        timestamp: '2023-01-01T00:00:00.000Z'
      }
    };

    it('should record financial analytics data', async () => {
      const logger = require('../../config/logger');

      await orderEventHandlers.recordFinancialAnalytics(mockEvent);

      expect(logger.debug).toHaveBeenCalledWith(
        'Financial analytics recorded',
        {
          orderId: 'order-123',
          event: 'payment_processed',
          timestamp: '2023-01-01T00:00:00.000Z',
          properties: {
            amount: 20.00
          }
        }
      );
    });
  });

  describe('restoreInventoryAfterPaymentFailure', () => {
    const mockEvent = {
      id: 'event-123',
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'user-123',
        items: [
          {
            productId: 'prod-123',
            quantity: 2
          }
        ]
      },
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-123'
      }
    };

    it('should publish inventory restoration events', async () => {
      eventBus.publish.mockResolvedValue();

      await orderEventHandlers.restoreInventoryAfterPaymentFailure(mockEvent);

      expect(eventBus.publish).toHaveBeenCalledWith(
        'inventory.updated',
        {
          productId: 'prod-123',
          quantity: 2, // Positive to restore
          operation: 'payment_failed',
          reason: 'Payment failed for order: ORD-001'
        },
        {
          correlationId: 'corr-123',
          causationId: 'event-123',
          userId: 'user-123'
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing event data gracefully', async () => {
      const incompleteEvent = {
        id: 'event-123',
        data: {}, // Missing required fields
        metadata: {}
      };

      // Should not throw errors for missing data
      await expect(orderEventHandlers.sendOrderConfirmation(incompleteEvent)).resolves.not.toThrow();
      await expect(orderEventHandlers.updateInventory(incompleteEvent)).resolves.not.toThrow();
    });

    it('should handle eventBus publish failures', async () => {
      const mockEvent = {
        id: 'event-123',
        data: {
          orderNumber: 'ORD-001',
          items: [{ productId: 'prod-123', quantity: 1 }]
        },
        metadata: {}
      };

      eventBus.publish.mockRejectedValue(new Error('EventBus error'));

      await expect(orderEventHandlers.updateInventory(mockEvent)).rejects.toThrow('EventBus error');
    });
  });
});
