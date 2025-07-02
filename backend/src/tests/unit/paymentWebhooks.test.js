const request = require('supertest');
const express = require('express');
const Order = require('../../models/Order');
const logger = require('../../config/logger');

// Mock dependencies
jest.mock('stripe', () => {
  const constructEventMock = jest.fn().mockImplementation((payload, signature) => {
    if (signature === 'invalid_signature') {
      const error = new Error('Invalid signature');
      error.type = 'StripeSignatureVerificationError';
      throw error;
    }
    return {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test123',
          amount: 2000,
          metadata: {
            userId: 'test-user-123',
            orderId: 'order-123'
          }
        }
      }
    };
  });

  const StripeMock = jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: constructEventMock
    }
  }));

  // Store the constructEvent mock for easy access
  StripeMock.constructEventMock = constructEventMock;

  return StripeMock;
});

jest.mock('../../models/Order', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../events/eventBus', () => ({
  eventBus: {
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const Stripe = require('stripe');
const stripe = new Stripe('test_key');
const { eventBus } = require('../../events/eventBus');

// Import payment controller after mocks are set up
const paymentController = require('../../controllers/paymentController');

// Setup Express app for testing
const app = express();

// Use raw body parser for webhook route
app.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  paymentController.handleWebhook
);

// Add error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error in middleware:', err);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message
  });
});

describe('Payment Webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';

    // Reset mocks
    Order.findOne.mockReset();
    eventBus.publish.mockReset();
    Stripe.constructEventMock.mockReset();

    // Reset the default mock implementation
    Stripe.constructEventMock.mockImplementation((payload, signature) => {
      if (signature === 'invalid_signature') {
        const error = new Error('Invalid signature');
        error.type = 'StripeSignatureVerificationError';
        throw error;
      }
      return {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: 2000,
            metadata: {
              userId: 'test-user-123',
              orderId: 'order-123'
            }
          }
        }
      };
    });
  });

  it('should handle signature verification failure', async () => {
    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'invalid_signature')
      .send(Buffer.from('test_payload'))
      .expect(400);

    expect(response.text).toContain('Webhook Error: Invalid signature');
  });

  it('should handle payment_intent.succeeded event', async () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-001',
      payment: {
        status: 'pending'
      },
      save: jest.fn().mockResolvedValue(undefined)
    };

    Order.findOne.mockResolvedValue(mockOrder);
    eventBus.publish.mockResolvedValue();

    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'test_signature')
      .send(Buffer.from('test_payload'))
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(mockOrder.payment.status).toBe('completed');
    expect(mockOrder.save).toHaveBeenCalled();
  });

  it('should handle payment success without order', async () => {
    Order.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'test_signature')
      .send(Buffer.from('test_payload'))
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(Order.findOne).toHaveBeenCalled();
  });

  it('should handle payment success without orderId in metadata', async () => {
    Stripe.constructEventMock.mockImplementationOnce(() => ({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test123',
          amount: 2000,
          metadata: {
            userId: 'test-user-123'
          }
        }
      }
    }));

    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'test_signature')
      .send(Buffer.from('test_payload'))
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(Order.findOne).not.toHaveBeenCalled();
  });

  it('should handle payment_intent.payment_failed event', async () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-001',
      payment: {
        status: 'pending'
      },
      save: jest.fn().mockResolvedValue(undefined)
    };

    Stripe.constructEventMock.mockImplementationOnce(() => ({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test123',
          amount: 2000,
          metadata: {
            userId: 'test-user-123',
            orderId: 'order-123'
          },
          last_payment_error: {
            message: 'Your card was declined.'
          }
        }
      }
    }));

    Order.findOne.mockResolvedValue(mockOrder);

    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'test_signature')
      .send(Buffer.from('test_payload'))
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(mockOrder.payment.status).toBe('failed');
    expect(mockOrder.payment.failureReason).toBe('Your card was declined.');
    expect(mockOrder.save).toHaveBeenCalled();
  });

  it('should handle webhook processing errors', async () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-001',
      payment: {
        status: 'pending'
      },
      save: jest.fn().mockRejectedValue(new Error('Database error'))
    };

    Order.findOne.mockResolvedValue(mockOrder);

    const response = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'test_signature')
      .send(Buffer.from('test_payload'))
      .expect(500);

    expect(response.body).toEqual({ error: 'Webhook handler failed' });
  });
});
