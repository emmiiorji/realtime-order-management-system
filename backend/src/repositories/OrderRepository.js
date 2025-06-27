const BaseRepository = require('./BaseRepository');
const Order = require('../models/Order');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  async findByOrderNumber(orderNumber) {
    try {
      const order = await this.model.findOne({ orderNumber });
      return order;
    } catch (error) {
      logger.error('Error finding order by order number:', error);
      throw this.handleError(error);
    }
  }

  async findByUserId(userId, options = {}) {
    try {
      const filter = { userId };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by user ID:', error);
      throw this.handleError(error);
    }
  }

  async findByStatus(status, options = {}) {
    try {
      const filter = { status };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by status:', error);
      throw this.handleError(error);
    }
  }

  async findByUserIdAndStatus(userId, status, options = {}) {
    try {
      const filter = { userId, status };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by user ID and status:', error);
      throw this.handleError(error);
    }
  }

  async createOrder(orderData) {
    try {
      const order = await this.create(orderData);
      return order;
    } catch (error) {
      logger.error('Error creating order:', error);
      throw this.handleError(error);
    }
  }

  async updateOrderStatus(id, status, updatedBy, reason, notes) {
    try {
      const order = await this.findById(id);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      await order.updateStatus(status, updatedBy, reason, notes);
      return order;
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw this.handleError(error);
    }
  }

  async addItemToOrder(orderId, item) {
    try {
      const order = await this.findById(orderId);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      await order.addItem(item);
      return order;
    } catch (error) {
      logger.error('Error adding item to order:', error);
      throw this.handleError(error);
    }
  }

  async removeItemFromOrder(orderId, productId) {
    try {
      const order = await this.findById(orderId);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      await order.removeItem(productId);
      return order;
    } catch (error) {
      logger.error('Error removing item from order:', error);
      throw this.handleError(error);
    }
  }

  async updatePaymentStatus(orderId, paymentData) {
    try {
      const updateData = {
        'payment.status': paymentData.status,
        'payment.transactionId': paymentData.transactionId,
        'payment.processedAt': paymentData.processedAt || new Date()
      };

      if (paymentData.failureReason) {
        updateData['payment.failureReason'] = paymentData.failureReason;
      }

      const order = await this.updateById(orderId, updateData);
      return order;
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw this.handleError(error);
    }
  }

  async updateShippingInfo(orderId, shippingData) {
    try {
      const updateData = {};
      
      if (shippingData.trackingNumber) {
        updateData['shipping.trackingNumber'] = shippingData.trackingNumber;
      }
      
      if (shippingData.carrier) {
        updateData['shipping.carrier'] = shippingData.carrier;
      }
      
      if (shippingData.estimatedDelivery) {
        updateData['shipping.estimatedDelivery'] = shippingData.estimatedDelivery;
      }

      const order = await this.updateById(orderId, updateData);
      return order;
    } catch (error) {
      logger.error('Error updating shipping info:', error);
      throw this.handleError(error);
    }
  }

  async findOrdersByDateRange(startDate, endDate, options = {}) {
    try {
      const filter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by date range:', error);
      throw this.handleError(error);
    }
  }

  async findOrdersByAmountRange(minAmount, maxAmount, options = {}) {
    try {
      const filter = {
        totalAmount: {
          $gte: minAmount,
          $lte: maxAmount
        }
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by amount range:', error);
      throw this.handleError(error);
    }
  }

  async findPendingOrders(options = {}) {
    try {
      const filter = { status: 'pending' };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding pending orders:', error);
      throw this.handleError(error);
    }
  }

  async findProcessingOrders(options = {}) {
    try {
      const filter = { status: { $in: ['confirmed', 'processing'] } };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding processing orders:', error);
      throw this.handleError(error);
    }
  }

  async findShippedOrders(options = {}) {
    try {
      const filter = { status: 'shipped' };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding shipped orders:', error);
      throw this.handleError(error);
    }
  }

  async findCompletedOrders(options = {}) {
    try {
      const filter = { status: 'delivered' };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding completed orders:', error);
      throw this.handleError(error);
    }
  }

  async findCancelledOrders(options = {}) {
    try {
      const filter = { status: 'cancelled' };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding cancelled orders:', error);
      throw this.handleError(error);
    }
  }

  async searchOrders(searchTerm, options = {}) {
    try {
      const filter = {
        $or: [
          { orderNumber: { $regex: searchTerm, $options: 'i' } },
          { 'items.productName': { $regex: searchTerm, $options: 'i' } },
          { 'shippingAddress.firstName': { $regex: searchTerm, $options: 'i' } },
          { 'shippingAddress.lastName': { $regex: searchTerm, $options: 'i' } },
          { 'shippingAddress.email': { $regex: searchTerm, $options: 'i' } }
        ]
      };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error searching orders:', error);
      throw this.handleError(error);
    }
  }

  async getOrderStats(dateRange = {}) {
    try {
      const stats = await Order.getStats(dateRange);
      return stats;
    } catch (error) {
      logger.error('Error getting order stats:', error);
      throw this.handleError(error);
    }
  }

  async getRevenueByPeriod(startDate, endDate, groupBy = 'day') {
    try {
      let groupStage;
      
      switch (groupBy) {
        case 'hour':
          groupStage = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          };
          break;
        case 'day':
          groupStage = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          };
          break;
        case 'month':
          groupStage = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          };
          break;
        case 'year':
          groupStage = {
            year: { $year: '$createdAt' }
          };
          break;
        default:
          groupStage = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          };
      }

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            },
            status: { $nin: ['cancelled'] }
          }
        },
        {
          $group: {
            _id: groupStage,
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            averageOrderValue: { $avg: '$totalAmount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
        }
      ];

      const revenue = await this.aggregate(pipeline);
      return revenue;
    } catch (error) {
      logger.error('Error getting revenue by period:', error);
      throw this.handleError(error);
    }
  }

  async getTopProducts(limit = 10, dateRange = {}) {
    try {
      const matchStage = {};
      
      if (dateRange.start || dateRange.end) {
        matchStage.createdAt = {};
        if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
        if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
      }

      const pipeline = [
        { $match: matchStage },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.productName' },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: limit }
      ];

      const topProducts = await this.aggregate(pipeline);
      return topProducts;
    } catch (error) {
      logger.error('Error getting top products:', error);
      throw this.handleError(error);
    }
  }

  async getCustomerOrderHistory(userId, options = {}) {
    try {
      const filter = { userId };
      const defaultOptions = {
        sort: { createdAt: -1 },
        ...options
      };
      return await this.findMany(filter, defaultOptions);
    } catch (error) {
      logger.error('Error getting customer order history:', error);
      throw this.handleError(error);
    }
  }

  async getOrdersByPaymentMethod(paymentMethod, options = {}) {
    try {
      const filter = { 'payment.method': paymentMethod };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by payment method:', error);
      throw this.handleError(error);
    }
  }

  async getOrdersByShippingMethod(shippingMethod, options = {}) {
    try {
      const filter = { 'shipping.method': shippingMethod };
      return await this.findMany(filter, options);
    } catch (error) {
      logger.error('Error finding orders by shipping method:', error);
      throw this.handleError(error);
    }
  }

  async bulkUpdateOrderStatus(orderIds, status, updatedBy) {
    try {
      const operations = orderIds.map(id => ({
        updateOne: {
          filter: { id },
          update: {
            status,
            'metadata.updatedBy': updatedBy,
            $push: {
              statusHistory: {
                status,
                timestamp: new Date(),
                updatedBy
              }
            }
          }
        }
      }));

      const result = await this.bulkWrite(operations);
      return result;
    } catch (error) {
      logger.error('Error in bulk order status update:', error);
      throw this.handleError(error);
    }
  }

  async getOrderAnalytics(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            averageOrderValue: { $avg: '$totalAmount' },
            statusBreakdown: {
              $push: '$status'
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
      ];

      const analytics = await this.aggregate(pipeline);
      return analytics;
    } catch (error) {
      logger.error('Error getting order analytics:', error);
      throw this.handleError(error);
    }
  }
}

module.exports = OrderRepository;
