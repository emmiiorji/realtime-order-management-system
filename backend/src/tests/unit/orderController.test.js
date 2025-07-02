const request = require('supertest');
const express = require('express');
const orderController = require('../../controllers/orderController');
const Order = require('../../models/Order');
const { eventBus } = require('../../events/eventBus');

// Mock dependencies
jest.mock('../../models/Order', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../events/eventBus', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../events/eventTypes', () => ({
  ORDER_EVENTS: {
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_CANCELLED: 'order.cancelled'
  }
}));

// Setup Express app for testing
const app = express();
app.use(express.json());
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

// Add routes
app.post('/orders', orderController.createOrder);
app.get('/orders/my-orders', orderController.getMyOrders);
app.get('/orders/:id', orderController.getOrder);
app.patch('/orders/:id', orderController.updateOrder);
app.delete('/orders/:id', orderController.cancelOrder);
app.get('/orders/:id/tracking', orderController.getOrderTracking);
app.get('/orders/stats', orderController.getOrderStats);
app.get('/orders', orderController.getAllOrders);
app.patch('/orders/:id/status', orderController.updateOrderStatus);

// Add simple error handling middleware for tests
app.use((err, req, res, next) => {
  console.error('Test error handler caught:', err.message);
  console.error('Error stack:', err.stack);
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    stack: process.env.NODE_ENV === 'test' ? err.stack : undefined
  });
});

describe('Order Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure all Order methods are properly mocked
    Order.create.mockReset();
    Order.findOne.mockReset();
    Order.findOneAndUpdate.mockReset();
    Order.find.mockReset();
    Order.countDocuments.mockReset();
    Order.aggregate.mockReset();

    // Ensure eventBus is properly mocked
    eventBus.publish.mockReset();
  });

  describe('POST /orders', () => {
    const validOrderData = {
      items: [
        {
          productId: 'prod-123',
          productName: 'Test Product',
          quantity: 2,
          unitPrice: 10.00,
          sku: 'TEST-SKU-001'
        }
      ],
      subtotal: 20.00,
      totalAmount: 20.00,
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

    it('should create order successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        items: validOrderData.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        totalAmount: 20.00,
        status: 'pending',
        shippingAddress: validOrderData.shippingAddress,
        payment: validOrderData.payment
      };

      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .post('/orders')
        .set('x-user-id', 'test-user-123')
        .send(validOrderData)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Order created successfully',
        data: {
          order: expect.objectContaining({
            id: 'order-123',
            orderNumber: 'ORD-001',
            userId: 'test-user-123'
          })
        }
      });

      expect(Order.create).toHaveBeenCalledWith({
        ...validOrderData,
        userId: 'test-user-123',
        items: validOrderData.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        metadata: expect.objectContaining({
          source: 'web',
          ipAddress: expect.any(String),
          userAgent: 'test-agent',
          createdBy: 'test-user-123'
        })
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: 'order-123',
          orderNumber: 'ORD-001',
          userId: 'test-user-123',
          items: expect.any(Array),
          totalAmount: 20.00,
          status: 'pending'
        }),
        expect.objectContaining({
          correlationId: 'test-correlation-123',
          userId: 'test-user-123'
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.post('/orders', orderController.createOrder);

      // Add error handling middleware
      appWithoutAuth.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          status: err.status || 'error',
          message: err.message
        });
      });

      const response = await request(appWithoutAuth)
        .post('/orders')
        .send(validOrderData)
        .expect(401);

      expect(response.body.message).toBe('User not authenticated');
    });

    it('should handle order creation failure', async () => {
      Order.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/orders')
        .set('x-user-id', 'test-user-123')
        .send(validOrderData)
        .expect(500);

      expect(response.body.status).toBe('error');
    });

    it('should calculate item totals correctly', async () => {
      const orderDataWithMultipleItems = {
        ...validOrderData,
        items: [
          {
            productId: 'prod-123',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 10.00,
            sku: 'SKU-001'
          },
          {
            productId: 'prod-456',
            productName: 'Product 2',
            quantity: 1,
            unitPrice: 15.00,
            sku: 'SKU-002'
          }
        ]
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        items: orderDataWithMultipleItems.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        })),
        totalAmount: 35.00,
        status: 'pending',
        shippingAddress: orderDataWithMultipleItems.shippingAddress,
        payment: orderDataWithMultipleItems.payment
      };

      Order.create.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      // Debug: Check if mocks are working
      console.log('Order.create mock setup:', Order.create.getMockName());
      console.log('eventBus.publish mock setup:', eventBus.publish.getMockName());

      const response = await request(app)
        .post('/orders')
        .set('x-user-id', 'test-user-123')
        .send(orderDataWithMultipleItems);

      if (response.status !== 201) {
        throw new Error(`Expected status 201 but got ${response.status}. Response: ${JSON.stringify(response.body, null, 2)}`);
      }

      expect(response.status).toBe(201);

      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              productId: 'prod-123',
              totalPrice: 20.00 // 2 * 10.00
            }),
            expect.objectContaining({
              productId: 'prod-456',
              totalPrice: 15.00 // 1 * 15.00
            })
          ]
        })
      );
    });
  });

  describe('GET /orders/my-orders', () => {
    it('should get user orders with pagination', async () => {
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
        .get('/orders/my-orders?page=1&limit=10')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        results: 1,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1
        },
        data: {
          orders: [
            {
              id: 'order-123',
              orderNumber: 'ORD-001',
              userId: 'test-user-123',
              status: 'pending',
              totalAmount: 20.00,
              createdAt: expect.any(String) // Date gets serialized to string
            }
          ]
        }
      });

      expect(Order.find).toHaveBeenCalledWith({ userId: 'test-user-123' });
    });

    it('should filter orders by status', async () => {
      Order.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      });
      Order.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/orders/my-orders?status=completed')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      expect(Order.find).toHaveBeenCalledWith({
        userId: 'test-user-123',
        status: 'completed'
      });
    });

    it('should use default pagination values', async () => {
      Order.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      });
      Order.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/orders/my-orders')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      const findChain = Order.find();
      expect(findChain.skip).toHaveBeenCalledWith(0); // (1-1) * 10
      expect(findChain.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('GET /orders/:id', () => {
    it('should get order by id', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        status: 'pending'
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/orders/order-123')
        .set('x-user-id', 'test-user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        data: {
          order: mockOrder
        }
      });

      expect(Order.findOne).toHaveBeenCalledWith({
        id: 'order-123',
        userId: 'test-user-123'
      });
    });

    it('should return 404 for non-existent order', async () => {
      Order.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/orders/non-existent')
        .set('x-user-id', 'test-user-123')
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });
  });

  describe('PATCH /orders/:id', () => {
    it('should update order successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'pending',
        save: jest.fn().mockResolvedValue()
      };

      const updateData = {
        notes: 'Order confirmed by customer'
      };

      Order.findOneAndUpdate.mockResolvedValue({
        ...mockOrder,
        notes: 'Order confirmed by customer'
      });
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .patch('/orders/order-123')
        .set('x-user-id', 'test-user-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Order updated successfully'
      });

      expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        { id: 'order-123', userId: 'test-user-123' },
        expect.objectContaining({
          notes: 'Order confirmed by customer',
          'metadata.updatedBy': 'test-user-123'
        }),
        { new: true, runValidators: true }
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.updated',
        expect.objectContaining({
          orderId: 'order-123',
          notes: 'Order confirmed by customer'
        }),
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent order', async () => {
      Order.findOneAndUpdate.mockResolvedValue(null);

      const response = await request(app)
        .patch('/orders/non-existent')
        .set('x-user-id', 'test-user-123')
        .send({ notes: 'test' })
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });
  });

  describe('DELETE /orders/:id', () => {
    it('should cancel order successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-001',
        userId: 'test-user-123',
        status: 'pending',
        totalAmount: 20.00,
        updateStatus: jest.fn().mockResolvedValue()
      };

      Order.findOne.mockResolvedValue(mockOrder);
      eventBus.publish.mockResolvedValue();

      const response = await request(app)
        .delete('/orders/order-123')
        .set('x-user-id', 'test-user-123')
        .send({ reason: 'Customer request' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        message: 'Order cancelled successfully'
      });

      expect(mockOrder.updateStatus).toHaveBeenCalledWith('cancelled', 'test-user-123', 'Customer request');

      expect(eventBus.publish).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({
          orderId: 'order-123',
          reason: 'Customer request'
        }),
        expect.any(Object)
      );
    });

    it('should not allow cancelling shipped orders', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'test-user-123',
        status: 'shipped'
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .delete('/orders/order-123')
        .set('x-user-id', 'test-user-123')
        .expect(400);

      expect(response.body.message).toBe('Order cannot be cancelled in its current status');
    });
  });
});
