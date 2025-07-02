const request = require('supertest');
const express = require('express');
const paymentRoutes = require('../../routes/paymentRoutes');
const { globalErrorHandler } = require('../../middleware/errorHandler');

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
  publish: jest.fn()
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const Stripe = require('stripe');
const stripe = new Stripe('test_key');

// Setup Express app for testing
const app = express();
app.use(express.json());

// Add user authentication middleware for testing
app.use((req, res, next) => {
  req.headers['x-user-id'] = 'test-user-123';
  req.headers['x-correlation-id'] = 'test-correlation-123';
  next();
});

app.use('/api/payments', paymentRoutes);
app.use(globalErrorHandler);

describe('Payment Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('POST /api/payments/create-intent', () => {
    it('should validate request body and create payment intent', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          amount: 2000,
          currency: 'usd',
          metadata: { test: 'data' }
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.paymentIntent.id).toBe('pi_test123');
    });

    it('should return 400 for missing amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          currency: 'usd'
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('amount');
    });

    it('should return 400 for invalid currency length', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          amount: 2000,
          currency: 'invalid'
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should handle Stripe errors gracefully', async () => {
      stripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API error'));

      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          amount: 2000,
          currency: 'usd'
        })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Failed to create payment intent');
    });
  });

  describe('POST /api/payments/confirm', () => {
    it('should validate request body and confirm payment', async () => {
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
        .post('/api/payments/confirm')
        .send({
          paymentIntentId: 'pi_test123',
          paymentMethodId: 'pm_test456'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.paymentIntent.status).toBe('succeeded');
    });

    it('should return 400 for missing paymentIntentId', async () => {
      const response = await request(app)
        .post('/api/payments/confirm')
        .send({
          paymentMethodId: 'pm_test456'
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('paymentIntentId');
    });

    it('should return 400 for missing paymentMethodId', async () => {
      const response = await request(app)
        .post('/api/payments/confirm')
        .send({
          paymentIntentId: 'pi_test123'
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('paymentMethodId');
    });
  });

  describe('GET /api/payments/payment-methods/:customerId', () => {
    it('should get payment methods for valid customer', async () => {
      const mockPaymentMethods = {
        data: [
          {
            id: 'pm_test123',
            type: 'card',
            card: { brand: 'visa', last4: '4242' }
          }
        ]
      };

      stripe.paymentMethods.list.mockResolvedValue(mockPaymentMethods);

      const response = await request(app)
        .get('/api/payments/payment-methods/test-user-123')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.paymentMethods).toEqual(mockPaymentMethods.data);
    });

    it('should return 403 for unauthorized customer access', async () => {
      const response = await request(app)
        .get('/api/payments/payment-methods/different-user')
        .expect(403);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toBe('Unauthorized access to payment methods');
    });
  });

  describe('POST /api/payments/save-payment-method', () => {
    it('should save payment method successfully', async () => {
      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card',
        customer: 'test-user-123'
      };

      stripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

      const response = await request(app)
        .post('/api/payments/save-payment-method')
        .send({
          customerId: 'test-user-123',
          paymentMethodId: 'pm_test123'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.paymentMethod).toEqual(mockPaymentMethod);
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should validate request body and process refund', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'test-user-123' }
      };

      const mockRefund = {
        id: 'ref_test123',
        amount: 2000,
        status: 'succeeded',
        reason: 'requested_by_customer'
      };

      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      stripe.refunds.create.mockResolvedValue(mockRefund);

      const response = await request(app)
        .post('/api/payments/refund')
        .send({
          paymentIntentId: 'pi_test123',
          amount: 2000,
          reason: 'requested_by_customer'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.refund.id).toBe('ref_test123');
    });

    it('should return 400 for missing paymentIntentId', async () => {
      const response = await request(app)
        .post('/api/payments/refund')
        .send({
          amount: 2000
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('paymentIntentId');
    });

    it('should return 400 for invalid reason', async () => {
      const response = await request(app)
        .post('/api/payments/refund')
        .send({
          paymentIntentId: 'pi_test123',
          amount: 2000,
          reason: 'invalid_reason'
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('GET /api/payments/history/:customerId', () => {
    it('should get payment history for valid customer', async () => {
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
        .get('/api/payments/history/test-user-123?limit=5')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.payments).toHaveLength(1);
      expect(response.body.data.payments[0].id).toBe('pi_test123');
    });

    it('should use default limit when not provided', async () => {
      const mockPaymentIntents = { data: [] };
      stripe.paymentIntents.list.mockResolvedValue(mockPaymentIntents);

      await request(app)
        .get('/api/payments/history/test-user-123')
        .expect(200);

      expect(stripe.paymentIntents.list).toHaveBeenCalledWith({
        customer: 'test-user-123',
        limit: 10
      });
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/payments', paymentRoutes);
      appWithoutAuth.use(globalErrorHandler);

      const response = await request(appWithoutAuth)
        .post('/api/payments/create-intent')
        .send({
          amount: 2000,
          currency: 'usd'
        })
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toBe('User not authenticated');
    });
  });
});
