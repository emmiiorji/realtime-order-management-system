const logger = require('../../config/logger');
const { ORDER_EVENTS, NOTIFICATION_EVENTS, INVENTORY_EVENTS } = require('../eventTypes');
const { eventBus } = require('../eventBus');

class OrderEventHandlers {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle order created events
    eventBus.subscribe(ORDER_EVENTS.ORDER_CREATED, this.handleOrderCreated.bind(this), {
      retry: true,
      maxRetries: 3,
      retryDelay: 1000
    });

    // Handle order updated events
    eventBus.subscribe(ORDER_EVENTS.ORDER_UPDATED, this.handleOrderUpdated.bind(this));

    // Handle order cancelled events
    eventBus.subscribe(ORDER_EVENTS.ORDER_CANCELLED, this.handleOrderCancelled.bind(this));

    // Handle order completed events
    eventBus.subscribe(ORDER_EVENTS.ORDER_COMPLETED, this.handleOrderCompleted.bind(this));

    // Handle order shipped events
    eventBus.subscribe(ORDER_EVENTS.ORDER_SHIPPED, this.handleOrderShipped.bind(this));

    // Handle payment processed events
    eventBus.subscribe(ORDER_EVENTS.ORDER_PAYMENT_PROCESSED, this.handlePaymentProcessed.bind(this));

    // Handle payment failed events
    eventBus.subscribe(ORDER_EVENTS.ORDER_PAYMENT_FAILED, this.handlePaymentFailed.bind(this));

    logger.info('Order event handlers initialized');
  }

  async handleOrderCreated(event) {
    try {
      const { orderId, orderNumber, userId, items, totalAmount } = event.data;

      logger.info(`Processing order created event: ${orderNumber}`, { 
        eventId: event.id,
        orderId,
        userId 
      });

      // Send order confirmation email
      await this.sendOrderConfirmation(event);

      // Update inventory
      await this.updateInventory(event);

      // Process payment
      await this.processPayment(event);

      // Create order analytics
      await this.createOrderAnalytics(event);

      // Notify fulfillment center
      await this.notifyFulfillmentCenter(event);

      logger.info(`Order created event processed successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing order created event: ${event.id}`, error);
      throw error;
    }
  }

  async handleOrderUpdated(event) {
    try {
      const { orderId, orderNumber, updatedFields } = event.data;

      logger.info(`Processing order updated event: ${orderNumber}`, { 
        eventId: event.id,
        orderId,
        updatedFields 
      });

      // Send update notification if significant changes
      if (this.hasSignificantChanges(updatedFields)) {
        await this.sendOrderUpdateNotification(event);
      }

      // Update analytics
      await this.updateOrderAnalytics(event);

      logger.info(`Order updated event processed successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing order updated event: ${event.id}`, error);
      throw error;
    }
  }

  async handleOrderCancelled(event) {
    try {
      const { orderId, orderNumber, userId, reason, refundAmount } = event.data;

      logger.info(`Processing order cancelled event: ${orderNumber}`, { 
        eventId: event.id,
        orderId,
        reason 
      });

      // Process refund
      await this.processRefund(event);

      // Restore inventory
      await this.restoreInventory(event);

      // Send cancellation notification
      await this.sendCancellationNotification(event);

      // Update analytics
      await this.updateCancellationAnalytics(event);

      logger.info(`Order cancelled event processed successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing order cancelled event: ${event.id}`, error);
      throw error;
    }
  }

  async handleOrderCompleted(event) {
    try {
      const { orderId, orderNumber, userId } = event.data;

      logger.info(`Processing order completed event: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

      // Send completion notification
      await this.sendCompletionNotification(event);

      // Request review
      await this.requestReview(event);

      // Update customer analytics
      await this.updateCustomerAnalytics(event);

      // Process loyalty points
      await this.processLoyaltyPoints(event);

      logger.info(`Order completed event processed successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing order completed event: ${event.id}`, error);
      throw error;
    }
  }

  async handleOrderShipped(event) {
    try {
      const { orderId, orderNumber, userId } = event.data;

      logger.info(`Processing order shipped event: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

      // Send shipping notification
      await this.sendShippingNotification(event);

      // Update tracking information
      await this.updateTrackingInfo(event);

      logger.info(`Order shipped event processed successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing order shipped event: ${event.id}`, error);
      throw error;
    }
  }

  async handlePaymentProcessed(event) {
    try {
      const { orderId, orderNumber, paymentAmount } = event.data;

      logger.info(`Processing payment processed event: ${orderNumber}`, { 
        eventId: event.id,
        orderId,
        paymentAmount 
      });

      // Send payment confirmation
      await this.sendPaymentConfirmation(event);

      // Update order status
      await this.updateOrderStatusAfterPayment(event);

      // Record financial analytics
      await this.recordFinancialAnalytics(event);

      logger.info(`Payment processed event handled successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing payment processed event: ${event.id}`, error);
      throw error;
    }
  }

  async handlePaymentFailed(event) {
    try {
      const { orderId, orderNumber, failureReason } = event.data;

      logger.info(`Processing payment failed event: ${orderNumber}`, { 
        eventId: event.id,
        orderId,
        failureReason 
      });

      // Send payment failure notification
      await this.sendPaymentFailureNotification(event);

      // Update order status
      await this.updateOrderStatusAfterPaymentFailure(event);

      // Restore inventory if needed
      await this.restoreInventoryAfterPaymentFailure(event);

      logger.info(`Payment failed event handled successfully: ${orderNumber}`, { 
        eventId: event.id,
        orderId 
      });

    } catch (error) {
      logger.error(`Error processing payment failed event: ${event.id}`, error);
      throw error;
    }
  }

  // Helper methods
  async sendOrderConfirmation(event) {
    const { userId, orderNumber, items = [], totalAmount } = event.data || {};

    // Skip if essential data is missing
    if (!userId || !orderNumber) {
      logger.warn('Skipping order confirmation - missing required data', {
        eventId: event.id,
        hasUserId: !!userId,
        hasOrderNumber: !!orderNumber
      });
      return;
    }

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Order Confirmation - ${orderNumber}`,
      template: 'order_confirmation',
      data: {
        orderNumber,
        items,
        totalAmount,
        orderDate: event.metadata?.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata?.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Order confirmation email queued for order: ${orderNumber}`);
  }

  async updateInventory(event) {
    const { items = [], orderNumber, userId } = event.data || {};

    // Skip if no items to process
    if (!items || items.length === 0) {
      logger.warn('Skipping inventory update - no items found', {
        eventId: event.id,
        orderNumber
      });
      return;
    }

    for (const item of items) {
      if (item.productId && item.quantity) {
        await eventBus.publish(INVENTORY_EVENTS.INVENTORY_UPDATED, {
          productId: item.productId,
          quantity: -item.quantity, // Negative for reduction
          operation: 'order_created',
          reason: `Order created: ${orderNumber}`
        }, {
          correlationId: event.metadata?.correlationId,
          causationId: event.id,
          userId
        });
      }
    }

    logger.debug(`Inventory update events published for order: ${orderNumber}`);
  }

  async processPayment(event) {
    const { orderId, orderNumber, totalAmount, paymentMethod } = event.data;

    logger.debug(`Processing payment for order: ${orderNumber}`, {
      orderId,
      totalAmount,
      paymentMethod
    });

    // Simulate payment processing
    // In a real implementation, this would integrate with payment processors
    const paymentSuccess = Math.random() < 0.8; // 80% success rate for demo

    if (paymentSuccess) {
      await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_PROCESSED, {
        orderId,
        orderNumber,
        paymentAmount: totalAmount,
        paymentMethod,
        transactionId: `txn_${Date.now()}`,
        processedAt: new Date().toISOString()
      }, {
        correlationId: event.metadata.correlationId,
        causationId: event.id,
        userId: event.data.userId
      });
    } else {
      await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_FAILED, {
        orderId,
        orderNumber,
        paymentAmount: totalAmount,
        paymentMethod,
        failureReason: 'Insufficient funds',
        failedAt: new Date().toISOString()
      }, {
        correlationId: event.metadata.correlationId,
        causationId: event.id,
        userId: event.data.userId
      });
    }
  }

  async createOrderAnalytics(event) {
    const { orderId, userId, items, totalAmount } = event.data;

    logger.debug(`Creating order analytics for order: ${orderId}`);

    const analyticsData = {
      orderId,
      userId,
      event: 'order_created',
      timestamp: event.metadata.timestamp,
      properties: {
        itemCount: items.length,
        totalAmount,
        orderSource: event.metadata.source,
        categories: [...new Set(items.map(item => item.category).filter(Boolean))]
      }
    };

    logger.debug('Order analytics created', analyticsData);
  }

  async notifyFulfillmentCenter(event) {
    const { orderId, orderNumber, items, shippingAddress } = event.data;

    logger.debug(`Notifying fulfillment center for order: ${orderNumber}`);

    // This would typically send to a fulfillment service
    const fulfillmentData = {
      orderId,
      orderNumber,
      items,
      shippingAddress,
      priority: 'standard'
    };

    logger.debug('Fulfillment center notified', fulfillmentData);
  }

  hasSignificantChanges(updatedFields) {
    const significantFields = ['status', 'items', 'shippingAddress', 'totalAmount'];
    return updatedFields.some(field => significantFields.includes(field));
  }

  async sendOrderUpdateNotification(event) {
    const { userId, orderNumber, updatedFields } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Order Update - ${orderNumber}`,
      template: 'order_updated',
      data: {
        orderNumber,
        updatedFields,
        updateTime: event.metadata.timestamp
      },
      priority: 'normal'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Order update notification sent for order: ${orderNumber}`);
  }

  async updateOrderAnalytics(event) {
    const { orderId, updatedFields } = event.data;

    logger.debug(`Updating order analytics for order: ${orderId}`);

    const analyticsData = {
      orderId,
      event: 'order_updated',
      timestamp: event.metadata.timestamp,
      properties: {
        updatedFields,
        updateSource: event.metadata.source
      }
    };

    logger.debug('Order update analytics recorded', analyticsData);
  }

  async processRefund(event) {
    const { orderId, orderNumber, refundAmount } = event.data;

    logger.debug(`Processing refund for order: ${orderNumber}`, {
      orderId,
      refundAmount
    });

    // Simulate refund processing
    // In a real implementation, this would integrate with payment processors
    logger.debug('Refund processed successfully', { orderId, refundAmount });
  }

  async restoreInventory(event) {
    // This would restore inventory for cancelled orders
    logger.debug(`Restoring inventory for cancelled order: ${event.data.orderNumber}`);
  }

  async sendCancellationNotification(event) {
    const { userId, orderNumber, reason } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Order Cancelled - ${orderNumber}`,
      template: 'order_cancelled',
      data: {
        orderNumber,
        reason,
        cancellationTime: event.metadata.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Cancellation notification sent for order: ${orderNumber}`);
  }

  async updateCancellationAnalytics(event) {
    const { orderId, reason } = event.data;

    logger.debug(`Recording cancellation analytics for order: ${orderId}`);

    const analyticsData = {
      orderId,
      event: 'order_cancelled',
      timestamp: event.metadata.timestamp,
      properties: {
        reason,
        cancellationSource: event.metadata.source
      }
    };

    logger.debug('Order cancellation analytics recorded', analyticsData);
  }

  async sendCompletionNotification(event) {
    const { userId, orderNumber } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Order Delivered - ${orderNumber}`,
      template: 'order_completed',
      data: {
        orderNumber,
        completionTime: event.metadata.timestamp
      },
      priority: 'normal'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Completion notification sent for order: ${orderNumber}`);
  }

  async requestReview(event) {
    const { userId, orderNumber, items } = event.data;

    logger.debug(`Requesting review for order: ${orderNumber}`);

    // This would typically trigger a review request system
    const reviewData = {
      userId,
      orderNumber,
      items,
      requestTime: event.metadata.timestamp
    };

    logger.debug('Review request created', reviewData);
  }

  async updateCustomerAnalytics(event) {
    const { userId, orderId } = event.data;

    logger.debug(`Updating customer analytics for user: ${userId}`);

    const analyticsData = {
      userId,
      orderId,
      event: 'order_completed',
      timestamp: event.metadata.timestamp
    };

    logger.debug('Customer analytics updated', analyticsData);
  }

  async processLoyaltyPoints(event) {
    const { userId, totalAmount } = event.data;

    logger.debug(`Processing loyalty points for user: ${userId}`);

    // Calculate points (e.g., 1 point per dollar)
    const points = Math.floor(totalAmount);

    logger.debug('Loyalty points processed', { userId, points });
  }

  async sendShippingNotification(event) {
    const { userId, orderNumber } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Order Shipped - ${orderNumber}`,
      template: 'order_shipped',
      data: {
        orderNumber,
        shippedTime: event.metadata.timestamp
      },
      priority: 'normal'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Shipping notification sent for order: ${orderNumber}`);
  }

  async updateTrackingInfo(event) {
    const { orderId, orderNumber } = event.data;

    logger.debug(`Updating tracking info for order: ${orderNumber}`);

    // This would typically update tracking information in the database
    logger.debug('Tracking info updated', { orderId });
  }

  async sendPaymentConfirmation(event) {
    const { userId, orderNumber, paymentAmount } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Payment Confirmed - ${orderNumber}`,
      template: 'payment_confirmed',
      data: {
        orderNumber,
        paymentAmount,
        confirmationTime: event.metadata.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Payment confirmation sent for order: ${orderNumber}`);
  }

  async updateOrderStatusAfterPayment(event) {
    const { orderId } = event.data;

    logger.debug(`Updating order status after payment for order: ${orderId}`);

    // This would typically update the order status in the database
    logger.debug('Order status updated after payment', { orderId });
  }

  async recordFinancialAnalytics(event) {
    const { orderId, paymentAmount } = event.data;

    logger.debug(`Recording financial analytics for order: ${orderId}`);

    const analyticsData = {
      orderId,
      event: 'payment_processed',
      timestamp: event.metadata.timestamp,
      properties: {
        amount: paymentAmount
      }
    };

    logger.debug('Financial analytics recorded', analyticsData);
  }

  async sendPaymentFailureNotification(event) {
    const { userId, orderNumber, failureReason } = event.data;

    await eventBus.publish(NOTIFICATION_EVENTS.EMAIL_SENT, {
      userId,
      subject: `Payment Failed - ${orderNumber}`,
      template: 'payment_failed',
      data: {
        orderNumber,
        failureReason,
        failureTime: event.metadata.timestamp
      },
      priority: 'high'
    }, {
      correlationId: event.metadata.correlationId,
      causationId: event.id,
      userId
    });

    logger.debug(`Payment failure notification sent for order: ${orderNumber}`);
  }

  async updateOrderStatusAfterPaymentFailure(event) {
    const { orderId } = event.data;

    logger.debug(`Updating order status after payment failure for order: ${orderId}`);

    // This would typically update the order status in the database
    logger.debug('Order status updated after payment failure', { orderId });
  }

  async restoreInventoryAfterPaymentFailure(event) {
    const { orderId, orderNumber, items } = event.data;

    logger.debug(`Restoring inventory after payment failure for order: ${orderId}`);

    // Restore inventory for each item
    if (items && items.length > 0) {
      for (const item of items) {
        await eventBus.publish(INVENTORY_EVENTS.INVENTORY_UPDATED, {
          productId: item.productId,
          quantity: item.quantity, // Positive to restore
          operation: 'payment_failed',
          reason: `Payment failed for order: ${orderNumber}`
        }, {
          correlationId: event.metadata.correlationId,
          causationId: event.id,
          userId: event.data.userId
        });
      }
    }

    logger.debug('Inventory restored after payment failure', { orderId });
  }
}

module.exports = OrderEventHandlers;
