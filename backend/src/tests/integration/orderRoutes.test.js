const request = require('supertest');
const express = require('express');
const orderRoutes = require('../../routes/orderRoutes');
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

const Order = require('../../models/Order');
const eventBus = require('../../events/eventBus');

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
app.use(globalErrorHandler);

describe('Order Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    const validOrderData = {
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

    it('should validate request body and create order', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        items: validOrderData.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        totalAmount: 20.00,
        status: 'pending'
      };

      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .post('/api/orders')
        .send(validOrderData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.order.id).toBe('order-123');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidOrderData = {
        items: [], // Empty items array
        shippingAddress: validOrderData.shippingAddress,
        payment: validOrderData.payment
      };

      const response = await request(app)
        .post('/api/orders')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('items');
    });

    it('should return 400 for invalid payment method', async () => {
      const invalidOrderData = {
        ...validOrderData,
        payment: {
          method: 'invalid_method',
          amount: 20.00,
          currency: 'USD'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should return 400 for invalid shipping address', async () => {
      const invalidOrderData = {
        ...validOrderData,
        shippingAddress: {
          firstName: 'John',
          // Missing required fields
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should handle database errors gracefully', async () => {
      Order.create.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/orders')
        .send(validOrderData)
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/orders/my-orders', () => {
    it('should get user orders with default pagination', async () => {
      const mockOrders = [
        {
          id: 'order-123',
          orderNumber: 'ORD-001',
          userId: 'test-user-123',
          status: 'pending',
          totalAmount: 20.00,
          createdAt: new Date()
        }
      ];

      Order.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/orders/my-orders')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.results).toBe(1);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        pages: 1
      });
      expect(response.body.data.orders).toEqual(mockOrders);
    });

    it('should handle pagination parameters', async () => {
      Order.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      });
      Order.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/orders/my-orders?page=2&limit=5')
        .expect(200);

      const findChain = Order.find();
      expect(findChain.skip).toHaveBeenCalledWith(5); // (2-1) * 5
      expect(findChain.limit).toHaveBeenCalledWith(5);
    });

    it('should filter by status', async () => {
      Order.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      });
      Order.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/orders/my-orders?status=completed')
        .expect(200);

      expect(Order.find).toHaveBeenCalledWith({
        userId: 'test-user-123',
        status: 'completed'
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by valid ID', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        status: 'pending'
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/api/orders/order-123')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.order).toEqual(mockOrder);
    });

    it('should return 404 for non-existent order', async () => {
      Order.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orders/non-existent')
        .expect(404);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toBe('Order not found');
    });

    it('should validate object ID format', async () => {
      const response = await request(app)
        .get('/api/orders/invalid-id-format')
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update order with valid data', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'pending',
        save: jest.fn().mockResolvedValue()
      };

      const updateData = {
        status: 'confirmed',
        notes: 'Order confirmed'
      };

      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .patch('/api/orders/order-123')
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should validate update data', async () => {
      const invalidUpdateData = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch('/api/orders/order-123')
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should cancel order successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'pending',
        save: jest.fn().mockResolvedValue()
      };

      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .delete('/api/orders/order-123')
        .send({ reason: 'Customer request' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should not allow cancelling completed orders', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'completed'
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .delete('/api/orders/order-123')
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('GET /api/orders/:id/tracking', () => {
    it('should get order tracking information', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        status: 'shipped',
        shipping: {
          trackingNumber: 'TRACK123',
          carrier: 'UPS'
        }
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/api/orders/order-123/tracking')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.tracking).toBeDefined();
    });
  });

  describe('GET /api/orders/stats', () => {
    it('should get order statistics', async () => {
      const mockStats = {
        totalOrders: 100,
        totalRevenue: 5000,
        averageOrderValue: 50,
        ordersByStatus: {
          pending: 10,
          confirmed: 20,
          shipped: 30,
          delivered: 35,
          cancelled: 5
        }
      };

      // Mock the aggregation pipeline
      Order.aggregate = jest.fn().mockResolvedValue([mockStats]);

      const response = await request(app)
        .get('/api/orders/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.stats).toBeDefined();
    });

    it('should handle date range filters for stats', async () => {
      Order.aggregate = jest.fn().mockResolvedValue([]);

      await request(app)
        .get('/api/orders/stats?startDate=2023-01-01&endDate=2023-12-31')
        .expect(200);

      expect(Order.aggregate).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/orders', orderRoutes);
      appWithoutAuth.use(globalErrorHandler);

      const response = await request(appWithoutAuth)
        .post('/api/orders')
        .send({
          items: [{ productId: 'test', quantity: 1, unitPrice: 10 }],
          shippingAddress: { firstName: 'Test' },
          payment: { method: 'stripe', amount: 10 }
        })
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toBe('User not authenticated');
    });
  });
});
