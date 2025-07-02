const Stripe = require('stripe');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Order = require('../models/Order');
const { eventBus } = require('../events/eventBus');
const { ORDER_EVENTS } = require('../events/eventTypes');
const logger = require('../config/logger');

// Initialize Stripe with secret key (only if provided)
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Helper function to check if Stripe is configured
const checkStripeConfiguration = () => {
  if (!stripe) {
    throw new AppError('Payment processing is not configured. Please contact support.', 503);
  }
};

// Create payment intent
exports.createPaymentIntent = catchAsync(async (req, res, next) => {
  // Check if Stripe is configured
  checkStripeConfiguration();

  const { amount, currency = 'usd', orderId, metadata = {} } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  if (!amount || amount <= 0) {
    return next(new AppError('Valid amount is required', 400));
  }

  try {
    // If orderId is provided, verify the order exists and belongs to the user
    let order = null;
    if (orderId) {
      order = await Order.findOne({ id: orderId, userId });
      if (!order) {
        return next(new AppError('Order not found', 404));
      }

      // Verify the amount matches the order total
      if (Math.round(amount) !== Math.round(order.totalAmount * 100)) {
        return next(new AppError('Payment amount does not match order total', 400));
      }
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        orderId: orderId || '',
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      userId,
      orderId
    });

    res.status(201).json({
      status: 'success',
      message: 'Payment intent created successfully',
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret
        }
      }
    });

  } catch (error) {
    logger.error('Error creating payment intent', error);
    return next(new AppError('Failed to create payment intent', 500));
  }
});

// Confirm payment
exports.confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentIntentId, paymentMethodId } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  if (!paymentIntentId) {
    return next(new AppError('Payment intent ID is required', 400));
  }

  try {
    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify the payment intent belongs to the user
    if (paymentIntent.metadata.userId !== userId) {
      return next(new AppError('Unauthorized access to payment intent', 403));
    }

    // Confirm the payment intent
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: `${process.env.FRONTEND_URL}/payment/return`
    });

    logger.info('Payment confirmed', {
      paymentIntentId,
      status: confirmedPayment.status,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment confirmed successfully',
      data: {
        paymentIntent: {
          id: confirmedPayment.id,
          status: confirmedPayment.status,
          amount: confirmedPayment.amount,
          currency: confirmedPayment.currency
        }
      }
    });

  } catch (error) {
    logger.error('Error confirming payment', error);
    return next(new AppError('Failed to confirm payment', 500));
  }
});

// Get payment methods for a customer
exports.getPaymentMethods = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  // For now, we'll use userId as customerId, but in a real app you'd have a mapping
  if (customerId !== userId) {
    return next(new AppError('Unauthorized access to payment methods', 403));
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    res.status(200).json({
      status: 'success',
      data: {
        paymentMethods: paymentMethods.data
      }
    });

  } catch (error) {
    logger.error('Error retrieving payment methods', error);
    return next(new AppError('Failed to retrieve payment methods', 500));
  }
});

// Save payment method
exports.savePaymentMethod = catchAsync(async (req, res, next) => {
  const { customerId, paymentMethodId } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  if (customerId !== userId) {
    return next(new AppError('Unauthorized access', 403));
  }

  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    logger.info('Payment method saved', {
      paymentMethodId,
      customerId,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment method saved successfully',
      data: {
        paymentMethod
      }
    });

  } catch (error) {
    logger.error('Error saving payment method', error);
    return next(new AppError('Failed to save payment method', 500));
  }
});

// Process refund
exports.processRefund = catchAsync(async (req, res, next) => {
  const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  if (!paymentIntentId) {
    return next(new AppError('Payment intent ID is required', 400));
  }

  try {
    // Retrieve the payment intent to verify ownership
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata.userId !== userId) {
      return next(new AppError('Unauthorized access to payment intent', 403));
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount) : undefined, // Partial or full refund
      reason
    });

    // Update order status if orderId exists
    if (paymentIntent.metadata.orderId) {
      const order = await Order.findOne({ id: paymentIntent.metadata.orderId });
      if (order) {
        // Publish refund event
        await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_REFUNDED, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          refundAmount: refund.amount,
          refundId: refund.id,
          reason,
          refundedAt: new Date().toISOString()
        }, {
          correlationId: req.headers['x-correlation-id'],
          userId
        });
      }
    }

    logger.info('Refund processed', {
      refundId: refund.id,
      paymentIntentId,
      amount: refund.amount,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Refund processed successfully',
      data: {
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason
        }
      }
    });

  } catch (error) {
    logger.error('Error processing refund', error);
    return next(new AppError('Failed to process refund', 500));
  }
});

// Get payment history
exports.getPaymentHistory = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;
  const { limit = 10 } = req.query;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  if (customerId !== userId) {
    return next(new AppError('Unauthorized access', 403));
  }

  try {
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: parseInt(limit)
    });

    res.status(200).json({
      status: 'success',
      data: {
        payments: paymentIntents.data.map(pi => ({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          created: pi.created,
          metadata: pi.metadata
        }))
      }
    });

  } catch (error) {

    console.log('Error retrieving payment history', error);
    logger.error('Error retrieving payment history', error);
    return next(new AppError('Failed to retrieve payment history', 500));
  }
});

// Webhook handler for Stripe events
exports.handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    console.log('------------------Stripe webhook called---------------');
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      logger.error('Webhook signature verification failed', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process webhook event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        case 'payment_intent.canceled':
          await handlePaymentCanceled(event.data.object);
          break;
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      // Always return success for webhook
      return res.json({ received: true });
    } catch (error) {
      logger.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  } catch (error) {
    logger.error('Unexpected error in webhook handler:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// Helper function to handle successful payments
async function handlePaymentSucceeded(paymentIntent) {
  const { orderId, userId } = paymentIntent.metadata || {};

  if (!orderId) {
    logger.info('Payment succeeded without order reference', {
      paymentIntentId: paymentIntent.id,
      userId
    });
    return;
  }

  const order = await Order.findOne({ id: orderId });
  if (!order) {
    logger.warn('Payment succeeded but order not found', {
      orderId,
      paymentIntentId: paymentIntent.id
    });
    return;
  }

  order.payment.status = 'completed';
  order.payment.transactionId = paymentIntent.id;
  order.payment.processedAt = new Date();
  await order.save();

  await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_PROCESSED, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentAmount: paymentIntent.amount / 100,
    paymentMethod: 'stripe',
    transactionId: paymentIntent.id,
    processedAt: new Date().toISOString()
  }, {
    userId: userId
  });

  logger.info('Payment succeeded and order updated', {
    orderId,
    paymentIntentId: paymentIntent.id
  });
}

// Helper function to handle failed payments
async function handlePaymentFailed(paymentIntent) {
  const { orderId, userId } = paymentIntent.metadata || {};

  if (!orderId) {
    logger.info('Payment failed without order reference', {
      paymentIntentId: paymentIntent.id,
      userId
    });
    return;
  }

  const order = await Order.findOne({ id: orderId });
  if (!order) {
    logger.warn('Payment failed but order not found', {
      orderId,
      paymentIntentId: paymentIntent.id
    });
    return;
  }

  order.payment.status = 'failed';
  order.payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
  await order.save();

  await eventBus.publish(ORDER_EVENTS.ORDER_PAYMENT_FAILED, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentAmount: paymentIntent.amount / 100,
    paymentMethod: 'stripe',
    failureReason: order.payment.failureReason,
    failedAt: new Date().toISOString()
  }, {
    userId: userId
  });

  logger.info('Payment failed and order updated', {
    orderId,
    paymentIntentId: paymentIntent.id,
    error: order.payment.failureReason
  });
}

// Helper function to handle canceled payments
async function handlePaymentCanceled(paymentIntent) {
  const { orderId, userId } = paymentIntent.metadata || {};

  if (!orderId) {
    logger.info('Payment canceled without order reference', {
      paymentIntentId: paymentIntent.id,
      userId
    });
    return;
  }

  const order = await Order.findOne({ id: orderId });
  if (!order) {
    logger.warn('Payment canceled but order not found', {
      orderId,
      paymentIntentId: paymentIntent.id
    });
    return;
  }

  order.payment.status = 'cancelled';
  await order.save();

  logger.info('Payment canceled and order updated', {
    orderId,
    paymentIntentId: paymentIntent.id
  });
}
