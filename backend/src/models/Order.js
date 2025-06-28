const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative']
  },
  sku: String,
  category: String,
  attributes: {
    size: String,
    color: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  }
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required']
  },
  street: {
    type: String,
    required: [true, 'Street address is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP code is required']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'US'
  },
  phone: String,
  instructions: String
});

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery'],
    required: [true, 'Payment method is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: String,
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD'
  },
  processedAt: Date,
  failureReason: String,
  refundAmount: Number,
  refundedAt: Date
});

const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  orderNumber: {
    type: String,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  shipping: {
    cost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup'],
      default: 'standard'
    },
    estimatedDelivery: Date,
    trackingNumber: String,
    carrier: String
  },
  discount: {
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative']
    },
    code: String,
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'free_shipping']
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD'
  },
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema,
  payment: paymentSchema,
  notes: String,
  customerNotes: String,
  internalNotes: String,
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: String,
    reason: String,
    notes: String
  }],
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web'
    },
    ipAddress: String,
    userAgent: String,
    referrer: String,
    campaign: String,
    createdBy: String,
    updatedBy: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'shipping.trackingNumber': 1 });

// Virtual for order age
orderSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for formatted order number
orderSchema.virtual('formattedOrderNumber').get(function() {
  return this.orderNumber || `ORD-${this.id.slice(-8).toUpperCase()}`;
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Find the last order of the day
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^${year}${month}${day}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `${year}${month}${day}${String(sequence).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to calculate totals
orderSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax + this.shipping.cost - this.discount.amount;
  
  // Ensure total is not negative
  if (this.totalAmount < 0) {
    this.totalAmount = 0;
  }
  
  next();
});

// Pre-save middleware to update status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.metadata.updatedBy || 'system'
    });
  }
  next();
});

// Instance method to add item
orderSchema.methods.addItem = function(item) {
  // Calculate total price for the item
  item.totalPrice = item.quantity * item.unitPrice;
  this.items.push(item);
  return this.save();
};

// Instance method to remove item
orderSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => item.productId !== productId);
  return this.save();
};

// Instance method to update status
orderSchema.methods.updateStatus = function(newStatus, updatedBy, reason, notes) {
  this.status = newStatus;
  this.metadata.updatedBy = updatedBy;
  
  if (reason || notes) {
    const historyEntry = this.statusHistory[this.statusHistory.length - 1];
    if (historyEntry) {
      historyEntry.reason = reason;
      historyEntry.notes = notes;
    }
  }
  
  return this.save();
};

// Static method to get order statistics
orderSchema.statics.getStats = async function(dateRange = {}) {
  const matchStage = {};
  
  if (dateRange.start || dateRange.end) {
    matchStage.createdAt = {};
    if (dateRange.start) matchStage.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.createdAt.$lte = new Date(dateRange.end);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0
  };
};

module.exports = mongoose.model('Order', orderSchema);
