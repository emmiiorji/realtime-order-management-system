// User Events
const USER_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout'
};

// Order Events
const ORDER_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',
  ORDER_PAYMENT_PROCESSED: 'order.payment.processed',
  ORDER_PAYMENT_FAILED: 'order.payment.failed',
  ORDER_PAYMENT_REFUNDED: 'order.payment.refunded',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered'
};

// System Events
const SYSTEM_EVENTS = {
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_HEALTH_CHECK: 'system.health.check'
};

// Notification Events
const NOTIFICATION_EVENTS = {
  EMAIL_SENT: 'notification.email.sent',
  SMS_SENT: 'notification.sms.sent',
  PUSH_NOTIFICATION_SENT: 'notification.push.sent',
  NOTIFICATION_FAILED: 'notification.failed'
};

// Inventory Events
const INVENTORY_EVENTS = {
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_LOW_STOCK: 'inventory.low.stock',
  INVENTORY_OUT_OF_STOCK: 'inventory.out.of.stock',
  INVENTORY_RESTOCKED: 'inventory.restocked'
};

// All events combined
const ALL_EVENTS = {
  ...USER_EVENTS,
  ...ORDER_EVENTS,
  ...SYSTEM_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...INVENTORY_EVENTS
};

// Event validation schemas
const EVENT_SCHEMAS = {
  [USER_EVENTS.USER_CREATED]: {
    required: ['userId', 'email', 'username'],
    optional: ['firstName', 'lastName', 'role']
  },
  [USER_EVENTS.USER_UPDATED]: {
    required: ['userId'],
    optional: ['email', 'username', 'firstName', 'lastName', 'role']
  },
  [USER_EVENTS.USER_DELETED]: {
    required: ['userId'],
    optional: ['reason']
  },
  [ORDER_EVENTS.ORDER_CREATED]: {
    required: ['orderId', 'userId', 'items', 'totalAmount'],
    optional: ['shippingAddress', 'paymentMethod', 'notes']
  },
  [ORDER_EVENTS.ORDER_UPDATED]: {
    required: ['orderId'],
    optional: ['status', 'items', 'totalAmount', 'shippingAddress']
  },
  [ORDER_EVENTS.ORDER_CANCELLED]: {
    required: ['orderId', 'reason'],
    optional: ['refundAmount', 'cancelledBy']
  },
  [INVENTORY_EVENTS.INVENTORY_UPDATED]: {
    required: ['productId', 'quantity', 'operation'],
    optional: ['reason', 'location']
  }
};

// Event priority levels
const EVENT_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
};

// Event categories for filtering and routing
const EVENT_CATEGORIES = {
  USER: 'user',
  ORDER: 'order',
  SYSTEM: 'system',
  NOTIFICATION: 'notification',
  INVENTORY: 'inventory'
};

// Helper functions
function getEventCategory(eventType) {
  if (Object.values(USER_EVENTS).includes(eventType)) {
    return EVENT_CATEGORIES.USER;
  }
  if (Object.values(ORDER_EVENTS).includes(eventType)) {
    return EVENT_CATEGORIES.ORDER;
  }
  if (Object.values(SYSTEM_EVENTS).includes(eventType)) {
    return EVENT_CATEGORIES.SYSTEM;
  }
  if (Object.values(NOTIFICATION_EVENTS).includes(eventType)) {
    return EVENT_CATEGORIES.NOTIFICATION;
  }
  if (Object.values(INVENTORY_EVENTS).includes(eventType)) {
    return EVENT_CATEGORIES.INVENTORY;
  }
  return 'unknown';
}

function validateEventData(eventType, data) {
  const schema = EVENT_SCHEMAS[eventType];
  if (!schema) {
    return { valid: true, errors: [] }; // No validation schema defined
  }

  const errors = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for unknown fields (optional validation)
  const allowedFields = [...schema.required, ...(schema.optional || [])];
  for (const field in data) {
    if (!allowedFields.includes(field)) {
      // This is just a warning, not an error
      console.warn(`Unknown field in event data: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function createEventMetadata(options = {}) {
  return {
    timestamp: new Date().toISOString(),
    source: options.source || 'microservice',
    version: options.version || '1.0.0',
    correlationId: options.correlationId,
    causationId: options.causationId,
    userId: options.userId,
    priority: options.priority || EVENT_PRIORITIES.NORMAL,
    category: options.category,
    tags: options.tags || []
  };
}

module.exports = {
  USER_EVENTS,
  ORDER_EVENTS,
  SYSTEM_EVENTS,
  NOTIFICATION_EVENTS,
  INVENTORY_EVENTS,
  ALL_EVENTS,
  EVENT_SCHEMAS,
  EVENT_PRIORITIES,
  EVENT_CATEGORIES,
  getEventCategory,
  validateEventData,
  createEventMetadata
};
