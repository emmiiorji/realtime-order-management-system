const request = require('supertest');
const express = require('express');
const paymentController = require('../../controllers/paymentController');
const Order = require('../../models/Order');
const { globalErrorHandler } = require('../../middleware/errorHandler');

// Set up environment variables for testing
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Mock dependencies
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      list: jest.fn()
    },
    paymentMethods: {
      list: jest.fn(),
      attach: jest.fn()
    },
    refunds: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

jest.mock('../../models/Order', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../events/eventBus', () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const Stripe = require('stripe');
const stripe = new Stripe('test_key');
const eventBus = require('../../events/eventBus');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.headers['x-user-id'] = 'test-user-123';
  next();
});

// Add routes
app.post('/create-intent', paymentController.createPaymentIntent);
app.post('/confirm', paymentController.confirmPayment);
app.get('/payment-methods/:customerId', paymentController.getPaymentMethods);
app.post('/save-payment-method', paymentController.savePaymentMethod);
app.post('/refund', paymentController.processRefund);
app.get('/history/:customerId', paymentController.getPaymentHistory);

// Add error handling middleware
app.use(globalErrorHandler);

describe('Payment Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure all Stripe methods return resolved promises by default
    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test123',
      amount: 2000,
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: 'pi_test123_secret'
    });
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_test123',
      metadata: { userId: 'test-user-123' }
    });
    stripe.paymentIntents.confirm.mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
      amount: 2000,
      currency: 'usd'
    });
    stripe.paymentMethods.list.mockResolvedValue({
      data: []
    });
    stripe.paymentMethods.attach.mockResolvedValue({
      id: 'pm_test123',
      type: 'card',
      customer: 'test-user-123'
    });
    stripe.refunds.create.mockResolvedValue({
      id: 'ref_test123',
      amount: 2000,
      status: 'succeeded',
      reason: 'requested_by_customer'
    });
    stripe.paymentIntents.list.mockResolvedValue({
      data: []
    });
    
    // Mock eventBus.publish to resolve immediately
    eventBus.publish.mockResolvedValue();
  });

  describe('POST /create-intent', () => {
    it('should create payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/create-intent')
        .set('x-user-id', 'test-user-123')
        .send({
          amount: 2000,
          currency: 'usd',
          metadata: { test: 'data' }
        })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Payment intent created successfully',
        data: {
          paymentIntent: {
            id: 'pi_test123',
            amount: 2000,
            currency: 'usd',
            status: 'requires_payment_method',
            client_secret: 'pi_test123_secret'
          }
        }
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        metadata: {
          userId: 'test-user-123',
          orderId: '',
          test: 'data'
        },
        automatic_payment_methods: {
          enabled: true
        }
      });
    });

    it('should create payment intent with order validation', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        totalAmount: 20.00
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      Order.findOne.mockResolvedValue(mockOrder);
      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/create-intent')
        .set('x-user-id', 'test-user-123')
        .send({
          amount: 2000,
          currency: 'usd',
          orderId: 'order-123'
        })
        .expect(201);

      expect(Order.findOne).toHaveBeenCalledWith({
        id: 'order-123',
        userId: 'test-user-123'
      });

      expect(response.body.status).toBe('success');
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/create-intent')
        .set('x-user-id', 'test-user-123')
        .send({
          amount: 0,
          currency: 'usd'
        })
        .expect(400);

      expect(response.body.message).toBe('Valid amount is required');
    });

    it('should return 404 for non-existent order', async () => {
      Order.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/create-intent')
        .set('x-user-id', 'test-user-123')
        .send({
          amount: 2000,
          currency: 'usd',
          orderId: 'non-existent-order'
        })
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });

    it('should return 400 for amount mismatch with order', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        totalAmount: 30.00 // Different amount
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/create-intent')
        .set('x-user-id', 'test-user-123')
        .send({
          amount: 2000, // $20.00
          currency: 'usd',
          orderId: 'order-123'
        })
        .expect(400);

      expect(response.body.message).toBe('Payment amount does not match order total');
    });
  });

  describe('POST /confirm', () => {
    it('should confirm payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'test-user-123' }
      };

      const mockConfirmedPayment = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd'
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      stripe.paymentIntents.confirm.mockResolvedValue(mockConfirmedPayment);

      const response = await request(app)
        .post('/confirm')
        .set('x-user-id', 'test-user-123')
        .send({
          paymentIntentId: 'pi_test123',
          paymentMethodId: 'pm_test456'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Payment confirmed successfully',
        data: {
          paymentIntent: {
            id: 'pi_test123',
            status: 'succeeded',
            amount: 2000,
            currency: 'usd'
          }
        }
      });

      expect(stripe.paymentIntents.confirm).toHaveBeenCalledWith('pi_test123', {
        payment_method: 'pm_test456',
        return_url: `${process.env.FRONTEND_URL}/payment/return`
      });
    });

    it('should return 403 for unauthorized payment intent access', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'different-user' }
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/confirm')
        .set('x-user-id', 'test-user-123')
        .send({
          paymentIntentId: 'pi_test123',
          paymentMethodId: 'pm_test456'
        })
        .expect(403);

      expect(response.body.message).toBe('Unauthorized access to payment intent');
    });
  });

  describe('GET /payment-methods/:customerId', () => {
    it('should get payment methods successfully', async () => {
      const mockPaymentMethods = {
        data: [
          {
            id: 'pm_test123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242'
            }
          }
        ]
      };

      stripe.paymentMethods.list.mockResolvedValue(mockPaymentMethods);

      const response = await request(app)
        .get('/payment-methods/test-user-123')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          paymentMethods: mockPaymentMethods.data
        }
      });

      expect(stripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'test-user-123',
        type: 'card'
      });
    });

    it('should return 403 for unauthorized customer access', async () => {
      const response = await request(app)
        .get('/payment-methods/different-user')
        .set('x-user-id', 'test-user-123')
        .expect(403);

      expect(response.body.message).toBe('Unauthorized access to payment methods');
    });
  });

  describe('POST /save-payment-method', () => {
    it('should save payment method successfully', async () => {
      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card',
        customer: 'test-user-123'
      };

      stripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

      const response = await request(app)
        .post('/save-payment-method')
        .set('x-user-id', 'test-user-123')
        .send({
          customerId: 'test-user-123',
          paymentMethodId: 'pm_test123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Payment method saved successfully',
        data: {
          paymentMethod: mockPaymentMethod
        }
      });

      expect(stripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test123', {
        customer: 'test-user-123'
      });
    });
  });

  describe('POST /refund', () => {
    it('should process refund successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: {
          userId: 'test-user-123',
          orderId: 'order-123'
        }
      };

      const mockRefund = {
        id: 'ref_test123',
        amount: 2000,
        status: 'succeeded',
        reason: 'requested_by_customer'
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001'
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      stripe.refunds.create.mockResolvedValue(mockRefund);
      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .post('/refund')
        .set('x-user-id', 'test-user-123')
        .send({
          paymentIntentId: 'pi_test123',
          amount: 2000,
          reason: 'requested_by_customer'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Refund processed successfully',
        data: {
          refund: {
            id: 'ref_test123',
            amount: 2000,
            status: 'succeeded',
            reason: 'requested_by_customer'
          }
        }
      });

      expect(stripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        amount: 2000,
        reason: 'requested_by_customer'
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.payment.refunded',
        expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'ORD-001',
          refundAmount: 2000,
          refundId: 'ref_test123'
        }),
        expect.objectContaining({
          userId: 'test-user-123'
        })
      );
    });

    it('should return 403 for unauthorized refund access', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'different-user' }
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/refund')
        .set('x-user-id', 'test-user-123')
        .send({
          paymentIntentId: 'pi_test123',
          amount: 2000
        })
        .expect(403);

      expect(response.body.message).toBe('Unauthorized access to payment intent');
    });
  });

  describe('GET /history/:customerId', () => {
    it('should get payment history successfully', async () => {
      const mockPaymentIntents = {
        data: [
          {
            id: 'pi_test123',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded',
            created: 1234567890,
            metadata: { orderId: 'order-123' }
          }
        ]
      };

      stripe.paymentIntents.list.mockResolvedValue(mockPaymentIntents);

      const response = await request(app)
        .get('/history/test-user-123?limit=5')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          payments: [
            {
              id: 'pi_test123',
              amount: 2000,
              currency: 'usd',
              status: 'succeeded',
              created: 1234567890,
              metadata: { orderId: 'order-123' }
            }
          ]
        }
      });

      expect(stripe.paymentIntents.list).toHaveBeenCalledWith({
        customer: 'test-user-123',
        limit: 5
      });
    });
  });
});
