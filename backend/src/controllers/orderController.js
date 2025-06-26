const Order = require('../models/Order');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { eventBus } = require('../events/eventBus');
const { ORDER_EVENTS } = require('../events/eventTypes');
const logger = require('../config/logger');

// Create a new order
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  // Add userId to the order data
  const orderData = {
    ...req.body,
    userId,
    metadata: {
      ...req.body.metadata,
      source: req.body.metadata?.source || 'web',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdBy: userId
    }
  };

  // Calculate item totals
  orderData.items = orderData.items.map(item => ({
    ...item,
    totalPrice: item.quantity * item.unitPrice
  }));

  const order = await Order.create(orderData);

  // Publish order created event
  await eventBus.publish(ORDER_EVENTS.ORDER_CREATED, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    items: order.items,
    totalAmount: order.totalAmount,
    status: order.status,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.payment.method
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: userId
  });

  logger.info(`New order created: ${order.orderNumber}`, { 
    orderId: order.id, 
    userId: order.userId,
    totalAmount: order.totalAmount 
  });

  res.status(201).json({
    status: 'success',
    message: 'Order created successfully',
    data: {
      order
    }
  });
});

// Get all orders (admin)
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
  }

  const orders = await Order.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Order.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      orders
    }
  });
});

// Get user's orders
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { userId };
  if (req.query.status) filter.status = req.query.status;

  const orders = await Order.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Order.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      orders
    }
  });
});

// Get single order
exports.getOrder = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  const orderId = req.params.id;

  const filter = { id: orderId };
  
  // Non-admin users can only see their own orders
  if (!req.headers['x-user-role'] || req.headers['x-user-role'] !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// Update order
exports.updateOrder = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  const orderId = req.params.id;

  const filter = { id: orderId };
  
  // Non-admin users can only update their own orders
  if (!req.headers['x-user-role'] || req.headers['x-user-role'] !== 'admin') {
    filter.userId = userId;
  }

  // Don't allow status updates through this route for non-admin users
  if (req.body.status && (!req.headers['x-user-role'] || req.headers['x-user-role'] !== 'admin')) {
    delete req.body.status;
  }

  const updatedOrder = await Order.findOneAndUpdate(
    filter,
    {
      ...req.body,
      'metadata.updatedBy': userId
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!updatedOrder) {
    return next(new AppError('Order not found', 404));
  }

  // Publish order updated event
  await eventBus.publish(ORDER_EVENTS.ORDER_UPDATED, {
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.orderNumber,
    userId: updatedOrder.userId,
    updatedFields: Object.keys(req.body),
    updatedBy: userId,
    ...req.body
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: userId
  });

  logger.info(`Order updated: ${updatedOrder.orderNumber}`, { 
    orderId: updatedOrder.id,
    updatedBy: userId 
  });

  res.status(200).json({
    status: 'success',
    message: 'Order updated successfully',
    data: {
      order: updatedOrder
    }
  });
});

// Update order status (admin only)
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, reason, notes } = req.body;
  const orderId = req.params.id;
  const updatedBy = req.headers['x-user-id'] || 'admin';

  if (!status) {
    return next(new AppError('Status is required', 400));
  }

  const order = await Order.findOne({ id: orderId });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const oldStatus = order.status;
  await order.updateStatus(status, updatedBy, reason, notes);

  // Publish appropriate event based on status
  let eventType = ORDER_EVENTS.ORDER_UPDATED;
  
  switch (status) {
    case 'cancelled':
      eventType = ORDER_EVENTS.ORDER_CANCELLED;
      break;
    case 'completed':
    case 'delivered':
      eventType = ORDER_EVENTS.ORDER_COMPLETED;
      break;
    case 'shipped':
      eventType = ORDER_EVENTS.ORDER_SHIPPED;
      break;
  }

  await eventBus.publish(eventType, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    oldStatus,
    newStatus: status,
    updatedBy,
    reason,
    notes
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: updatedBy
  });

  logger.info(`Order status updated: ${order.orderNumber} from ${oldStatus} to ${status}`, { 
    orderId: order.id,
    updatedBy 
  });

  res.status(200).json({
    status: 'success',
    message: 'Order status updated successfully',
    data: {
      order
    }
  });
});

// Cancel order
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  const orderId = req.params.id;
  const { reason } = req.body;

  const filter = { id: orderId };
  
  // Non-admin users can only cancel their own orders
  if (!req.headers['x-user-role'] || req.headers['x-user-role'] !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order can be cancelled
  if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
    return next(new AppError('Order cannot be cancelled in its current status', 400));
  }

  await order.updateStatus('cancelled', userId, reason || 'Cancelled by user');

  // Publish order cancelled event
  await eventBus.publish(ORDER_EVENTS.ORDER_CANCELLED, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    reason: reason || 'Cancelled by user',
    cancelledBy: userId,
    refundAmount: order.totalAmount
  }, {
    correlationId: req.headers['x-correlation-id'],
    userId: userId
  });

  logger.info(`Order cancelled: ${order.orderNumber}`, { 
    orderId: order.id,
    cancelledBy: userId,
    reason 
  });

  res.status(200).json({
    status: 'success',
    message: 'Order cancelled successfully',
    data: {
      order
    }
  });
});

// Get order tracking information
exports.getOrderTracking = catchAsync(async (req, res, next) => {
  const userId = req.headers['x-user-id']; // Temporary solution
  const orderId = req.params.id;

  const filter = { id: orderId };
  
  // Non-admin users can only track their own orders
  if (!req.headers['x-user-role'] || req.headers['x-user-role'] !== 'admin') {
    filter.userId = userId;
  }

  const order = await Order.findOne(filter).select('id orderNumber status statusHistory shipping createdAt');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      tracking: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        trackingNumber: order.shipping.trackingNumber,
        carrier: order.shipping.carrier,
        estimatedDelivery: order.shipping.estimatedDelivery,
        statusHistory: order.statusHistory,
        createdAt: order.createdAt
      }
    }
  });
});

// Get order statistics
exports.getOrderStats = catchAsync(async (req, res, next) => {
  const dateRange = {};
  
  if (req.query.startDate) dateRange.start = req.query.startDate;
  if (req.query.endDate) dateRange.end = req.query.endDate;

  const stats = await Order.getStats(dateRange);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});
