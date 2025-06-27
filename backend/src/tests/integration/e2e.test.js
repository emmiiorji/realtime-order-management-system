const request = require('supertest');
const express = require('express');
const orderRoutes = require('../../routes/orderRoutes');
const paymentRoutes = require('../../routes/paymentRoutes');
const { globalErrorHandler } = require('../../middleware/errorHandler');

// Mock dependencies
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

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

const Order = require('../../models/Order');
const eventBus = require('../../events/eventBus');
const Stripe = require('stripe');
const stripe = new Stripe('test_key');

// Setup Express app for testing
const app = express();
app.use(express.json());

// Add user authentication middleware for testing
app.use((req, res, next) => {
  req.headers['x-user-id'] = 'test-user-123';
  req.headers['x-correlation-id'] = 'test-correlation-123';
  req.ip = '127.0.0.1';
  req.get = jest.fn((header) => {
    if (header === 'User-Agent') return 'test-agent';
    return null;
  });
  next();
});

app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use(globalErrorHandler);

describe('End-to-End Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('Complete Order-to-Payment Flow', () => {
    it('should handle complete order creation and payment flow', async () => {
      const orderData = {
        items: [
          {
            productId: 'prod-123',
            name: 'Test Product',
            quantity: 2,
            unitPrice: 10.00,
            sku: 'TEST-SKU-001'
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        payment: {
          method: 'stripe',
          amount: 20.00,
          currency: 'USD'
        }
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        items: orderData.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        totalAmount: 20.00,
        status: 'pending',
        shippingAddress: orderData.shippingAddress,
        payment: orderData.payment
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        client_secret: 'pi_test123_secret'
      };

      // Mock order creation
      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      // Mock payment intent creation
      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Step 1: Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);

      expect(orderResponse.body.status).toBe('success');
      expect(orderResponse.body.data.order.id).toBe('order-123');

      // Verify order created event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'ORD-001',
          userId: 'test-user-123',
          totalAmount: 20.00
        }),
        expect.any(Object)
      );

      // Step 2: Create payment intent for the order
      const paymentResponse = await request(app)
        .post('/api/payments/create-intent')
        .send({
          amount: 2000,
          currency: 'usd',
          orderId: 'order-123',
          metadata: { userId: 'test-user-123' }
        })
        .expect(201);

      expect(paymentResponse.body.status).toBe('success');
      expect(paymentResponse.body.data.paymentIntent.id).toBe('pi_test123');

      // Verify Stripe payment intent was created with correct parameters
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        metadata: {
          userId: 'test-user-123',
          orderId: 'order-123'
        },
        automatic_payment_methods: {
          enabled: true
        }
      });
    });

    it('should handle payment success and order update flow', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'pending',
        payment: {
          status: 'pending'
        },
        save: jest.fn().mockResolvedValue()
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'test-user-123', orderId: 'order-123' }
      };

      const mockConfirmedPayment = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd'
      };

      // Mock payment confirmation
      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      stripe.paymentIntents.confirm.mockResolvedValue(mockConfirmedPayment);

      // Mock order retrieval and update
      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      // Step 1: Confirm payment
      const paymentResponse = await request(app)
        .post('/api/payments/confirm')
        .send({
          paymentIntentId: 'pi_test123',
          paymentMethodId: 'pm_test456'
        })
        .expect(200);

      expect(paymentResponse.body.status).toBe('success');
      expect(paymentResponse.body.data.paymentIntent.status).toBe('succeeded');

      // Step 2: Update order status after payment
      const orderResponse = await request(app)
        .patch('/api/orders/order-123')
        .send({
          status: 'confirmed',
          payment: {
            status: 'completed',
            transactionId: 'pi_test123'
          }
        })
        .expect(200);

      expect(orderResponse.body.status).toBe('success');

      // Verify order was updated
      expect(mockOrder.status).toBe('confirmed');
      expect(mockOrder.save).toHaveBeenCalled();

      // Verify order updated event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.updated',
        expect.objectContaining({
          orderId: 'order-123',
          status: 'confirmed'
        }),
        expect.any(Object)
      );
    });

    it('should handle payment failure and order cancellation flow', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'pending',
        save: jest.fn().mockResolvedValue()
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        metadata: { userId: 'test-user-123', orderId: 'order-123' },
        last_payment_error: { message: 'Your card was declined.' }
      };

      // Mock payment failure
      stripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      // Mock order retrieval
      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      // Step 1: Handle payment failure (simulated via webhook)
      const webhookEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: mockPaymentIntent
        }
      };

      stripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      const webhookResponse = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(Buffer.from('test_payload'))
        .expect(200);

      expect(webhookResponse.body).toEqual({ received: true });

      // Step 2: Cancel order due to payment failure
      const cancelResponse = await request(app)
        .delete('/api/orders/order-123')
        .send({ reason: 'Payment failed' })
        .expect(200);

      expect(cancelResponse.body.status).toBe('success');

      // Verify order was cancelled
      expect(mockOrder.status).toBe('cancelled');
      expect(mockOrder.save).toHaveBeenCalled();

      // Verify order cancelled event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({
          orderId: 'order-123',
          reason: 'Payment failed'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Inventory Management Integration', () => {
    it('should handle inventory updates during order processing', async () => {
      const orderData = {
        items: [
          {
            productId: 'prod-123',
            name: 'Test Product',
            quantity: 2,
            unitPrice: 10.00,
            sku: 'TEST-SKU-001'
          },
          {
            productId: 'prod-456',
            name: 'Another Product',
            quantity: 1,
            unitPrice: 15.00,
            sku: 'TEST-SKU-002'
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        payment: {
          method: 'stripe',
          amount: 35.00,
          currency: 'USD'
        }
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        items: orderData.items,
        totalAmount: 35.00,
        status: 'pending'
      };

      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      // Create order
      await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);

      // Verify inventory update events were published for each item
      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: 'order-123',
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'prod-123',
              quantity: 2
            }),
            expect.objectContaining({
              productId: 'prod-456',
              quantity: 1
            })
          ])
        }),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database failures gracefully', async () => {
      Order.create.mockRejectedValue(new Error('Database connection failed'));

      const orderData = {
        items: [
          {
            productId: 'prod-123',
            name: 'Test Product',
            quantity: 1,
            unitPrice: 10.00,
            sku: 'TEST-SKU-001'
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        payment: {
          method: 'stripe',
          amount: 10.00,
          currency: 'USD'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(500);

      expect(response.body.status).toBe('error');
    });

    it('should handle Stripe API failures gracefully', async () => {
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

    it('should handle event publishing failures gracefully', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        totalAmount: 20.00,
        status: 'pending'
      };

      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockRejectedValue(new Error('Event bus error'));

      const orderData = {
        items: [
          {
            productId: 'prod-123',
            name: 'Test Product',
            quantity: 2,
            unitPrice: 10.00,
            sku: 'TEST-SKU-001'
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        payment: {
          method: 'stripe',
          amount: 20.00,
          currency: 'USD'
        }
      };

      // Order creation should still succeed even if event publishing fails
      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.order.id).toBe('order-123');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/orders', orderRoutes);
      appWithoutAuth.use('/api/payments', paymentRoutes);
      appWithoutAuth.use(globalErrorHandler);

      // Test order creation without auth
      await request(appWithoutAuth)
        .post('/api/orders')
        .send({
          items: [{ productId: 'test', quantity: 1, unitPrice: 10 }],
          shippingAddress: { firstName: 'Test' },
          payment: { method: 'stripe', amount: 10 }
        })
        .expect(401);

      // Test payment intent creation without auth
      await request(appWithoutAuth)
        .post('/api/payments/create-intent')
        .send({
          amount: 1000,
          currency: 'usd'
        })
        .expect(401);
    });
  });
});
