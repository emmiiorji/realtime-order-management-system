import { vi } from 'vitest';
import { OrderService } from '../../services/orderService';
import { api } from '../../services/api';

// Mock the API
vi.mock('../../services/api');
const mockedApi = api as any;

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
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

    it('should create order successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          message: 'Order created successfully',
          data: {
            order: {
              id: 'order-123',
              orderNumber: 'ORD-001',
              userId: 'user-123',
              items: validOrderData.items,
              totalAmount: 20.00,
              status: 'pending',
              shippingAddress: validOrderData.shippingAddress,
              payment: validOrderData.payment,
              createdAt: '2023-01-01T00:00:00.000Z'
            }
          }
        }
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await OrderService.createOrder(validOrderData);

      expect(mockedApi.post).toHaveBeenCalledWith('/orders', validOrderData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle order creation failure', async () => {
      const errorResponse = {
        response: {
          data: {
            status: 'fail',
            message: 'Validation error'
          }
        }
      };

      mockedApi.post.mockRejectedValue(errorResponse);

      await expect(OrderService.createOrder(validOrderData)).rejects.toEqual(errorResponse);
    });
  });

  describe('getMyOrders', () => {
    it('should get user orders with default parameters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          results: 2,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1
          },
          data: {
            orders: [
              {
                id: 'order-123',
                orderNumber: 'ORD-001',
                status: 'pending',
                totalAmount: 20.00,
                createdAt: '2023-01-01T00:00:00.000Z'
              },
              {
                id: 'order-456',
                orderNumber: 'ORD-002',
                status: 'completed',
                totalAmount: 35.00,
                createdAt: '2023-01-02T00:00:00.000Z'
              }
            ]
          }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await OrderService.getMyOrders();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/my-orders', { params: undefined });
      expect(result).toEqual(mockResponse.data);
    });

    it('should get user orders with pagination parameters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          results: 1,
          data: { orders: [] }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const params = {
        page: 2,
        limit: 5,
        status: 'completed'
      };

      await OrderService.getMyOrders(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/my-orders', { params });
    });
  });

  describe('getOrder', () => {
    it('should get order by ID successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            order: {
              id: 'order-123',
              orderNumber: 'ORD-001',
              status: 'pending',
              totalAmount: 20.00,
              items: [
                {
                  productId: 'prod-123',
                  name: 'Test Product',
                  quantity: 2,
                  unitPrice: 10.00
                }
              ]
            }
          }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await OrderService.getOrder('order-123');

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/order-123');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle order not found', async () => {
      const errorResponse = {
        response: {
          status: 404,
          data: {
            status: 'fail',
            message: 'Order not found'
          }
        }
      };

      mockedApi.get.mockRejectedValue(errorResponse);

      await expect(OrderService.getOrder('non-existent')).rejects.toEqual(errorResponse);
    });
  });

  describe('updateOrder', () => {
    it('should update order successfully', async () => {
      const updateData = {
        status: 'confirmed',
        notes: 'Order confirmed by customer'
      };

      const mockResponse = {
        data: {
          status: 'success',
          message: 'Order updated successfully',
          data: {
            order: {
              id: 'order-123',
              status: 'confirmed',
              notes: 'Order confirmed by customer'
            }
          }
        }
      };

      mockedApi.patch.mockResolvedValue(mockResponse);

      const result = await OrderService.updateOrder('order-123', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/order-123', updateData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          message: 'Order cancelled successfully',
          data: {
            order: {
              id: 'order-123',
              status: 'cancelled'
            }
          }
        }
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      const result = await OrderService.cancelOrder('order-123', 'Customer request');

      expect(mockedApi.delete).toHaveBeenCalledWith('/orders/order-123', {
        data: { reason: 'Customer request' }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should cancel order without reason', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: { order: { id: 'order-123', status: 'cancelled' } }
        }
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      await OrderService.cancelOrder('order-123');

      expect(mockedApi.delete).toHaveBeenCalledWith('/orders/order-123', {
        data: { reason: undefined }
      });
    });
  });

  describe('getOrderTracking', () => {
    it('should get order tracking information', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            tracking: {
              trackingNumber: 'TRACK123',
              carrier: 'UPS',
              status: 'in_transit',
              estimatedDelivery: '2023-01-05T00:00:00.000Z',
              events: [
                {
                  status: 'shipped',
                  timestamp: '2023-01-01T00:00:00.000Z',
                  location: 'Origin facility'
                },
                {
                  status: 'in_transit',
                  timestamp: '2023-01-02T00:00:00.000Z',
                  location: 'Transit facility'
                }
              ]
            }
          }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await OrderService.getOrderTracking('order-123');

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/order-123/tracking');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getAllOrders (Admin)', () => {
    it('should get all orders with filters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          results: 5,
          data: { orders: [] }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const params = {
        page: 1,
        limit: 20,
        status: 'pending',
        userId: 'user-123',
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      };

      await OrderService.getAllOrders(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/orders', { params });
    });
  });

  describe('updateOrderStatus (Admin)', () => {
    it('should update order status successfully', async () => {
      const statusData = {
        status: 'shipped',
        reason: 'Order dispatched',
        notes: 'Tracking number: TRACK123'
      };

      const mockResponse = {
        data: {
          status: 'success',
          data: {
            order: {
              id: 'order-123',
              status: 'shipped'
            }
          }
        }
      };

      mockedApi.patch.mockResolvedValue(mockResponse);

      const result = await OrderService.updateOrderStatus('order-123', statusData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/orders/order-123/status', statusData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getOrderStats', () => {
    it('should get order statistics', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            stats: {
              totalOrders: 100,
              totalRevenue: 5000,
              averageOrderValue: 50,
              ordersByStatus: {
                pending: 10,
                confirmed: 20,
                shipped: 30,
                delivered: 35,
                cancelled: 5
              },
              revenueByMonth: [
                { month: '2023-01', revenue: 1000 },
                { month: '2023-02', revenue: 1500 }
              ]
            }
          }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await OrderService.getOrderStats({
        startDate: '2023-01-01',
        endDate: '2023-02-28'
      });

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/stats', {
        params: {
          startDate: '2023-01-01',
          endDate: '2023-02-28'
        }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should get order statistics without date filters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: { stats: {} }
        }
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await OrderService.getOrderStats();

      expect(mockedApi.get).toHaveBeenCalledWith('/orders/stats', {
        params: undefined
      });
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for order statuses', () => {
      expect(OrderService.getStatusColor('pending')).toBe('#f59e0b');
      expect(OrderService.getStatusColor('confirmed')).toBe('#3b82f6');
      expect(OrderService.getStatusColor('processing')).toBe('#8b5cf6');
      expect(OrderService.getStatusColor('shipped')).toBe('#06b6d4');
      expect(OrderService.getStatusColor('delivered')).toBe('#10b981');
      expect(OrderService.getStatusColor('cancelled')).toBe('#ef4444');
      expect(OrderService.getStatusColor('refunded')).toBe('#6b7280');
    });

    it('should return default color for unknown status', () => {
      expect(OrderService.getStatusColor('unknown_status' as any)).toBe('#6b7280');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockedApi.get.mockRejectedValue(networkError);

      await expect(OrderService.getOrder('order-123')).rejects.toThrow('Network Error');
    });

    it('should handle API errors with response data', async () => {
      const apiError = {
        response: {
          status: 400,
          data: {
            status: 'fail',
            message: 'Invalid order data'
          }
        }
      };

      mockedApi.post.mockRejectedValue(apiError);

      await expect(OrderService.createOrder({} as any)).rejects.toEqual(apiError);
    });
  });
});
