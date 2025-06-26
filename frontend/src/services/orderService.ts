import { api, ApiResponse, Order, CreateOrderRequest } from './api';

export class OrderService {
  // Order management
  static async createOrder(orderData: CreateOrderRequest): Promise<ApiResponse<{ order: Order }>> {
    const response = await api.post<ApiResponse<{ order: Order }>>('/orders', orderData);
    return response.data;
  }

  static async getMyOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<{ orders: Order[] }>> {
    const response = await api.get<ApiResponse<{ orders: Order[] }>>('/orders/my-orders', { params });
    return response.data;
  }

  static async getOrder(orderId: string): Promise<ApiResponse<{ order: Order }>> {
    const response = await api.get<ApiResponse<{ order: Order }>>(`/orders/${orderId}`);
    return response.data;
  }

  static async updateOrder(orderId: string, updateData: Partial<CreateOrderRequest>): Promise<ApiResponse<{ order: Order }>> {
    const response = await api.patch<ApiResponse<{ order: Order }>>(`/orders/${orderId}`, updateData);
    return response.data;
  }

  static async cancelOrder(orderId: string, reason?: string): Promise<ApiResponse<{ order: Order }>> {
    const response = await api.delete<ApiResponse<{ order: Order }>>(`/orders/${orderId}`, {
      data: { reason }
    });
    return response.data;
  }

  static async getOrderTracking(orderId: string): Promise<ApiResponse<{ tracking: any }>> {
    const response = await api.get<ApiResponse<{ tracking: any }>>(`/orders/${orderId}/tracking`);
    return response.data;
  }

  // Admin functions
  static async getAllOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ orders: Order[] }>> {
    const response = await api.get<ApiResponse<{ orders: Order[] }>>('/orders', { params });
    return response.data;
  }

  static async updateOrderStatus(orderId: string, statusData: {
    status: Order['status'];
    reason?: string;
    notes?: string;
  }): Promise<ApiResponse<{ order: Order }>> {
    const response = await api.patch<ApiResponse<{ order: Order }>>(`/orders/${orderId}/status`, statusData);
    return response.data;
  }

  static async getOrderStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ stats: any }>> {
    const response = await api.get<ApiResponse<{ stats: any }>>('/orders/stats', { params });
    return response.data;
  }

  // Utility functions
  static getStatusColor(status: Order['status']): string {
    const statusColors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      processing: '#8b5cf6',
      shipped: '#06b6d4',
      delivered: '#10b981',
      cancelled: '#ef4444',
      refunded: '#6b7280'
    };
    return statusColors[status] || '#6b7280';
  }

  static getStatusLabel(status: Order['status']): string {
    const statusLabels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded'
    };
    return statusLabels[status] || status;
  }

  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  static calculateOrderTotal(items: CreateOrderRequest['items'], shipping: number = 0, tax: number = 0, discount: number = 0): number {
    const subtotal = items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
    return subtotal + shipping + tax - discount;
  }

  static canCancelOrder(order: Order): boolean {
    return !['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status);
  }

  static canUpdateOrder(order: Order): boolean {
    return ['pending', 'confirmed'].includes(order.status);
  }

  static getEstimatedDeliveryDate(shippingMethod: Order['shipping']['method']): Date {
    const now = new Date();
    const deliveryDays = {
      standard: 7,
      express: 3,
      overnight: 1,
      pickup: 0
    };
    
    const days = deliveryDays[shippingMethod] || 7;
    now.setDate(now.getDate() + days);
    return now;
  }
}

export default OrderService;
