const Joi = require('joi');
const AppError = require('../utils/appError');

// User validation schemas
const userSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must only contain alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'First name cannot exceed 50 characters'
    }),
  lastName: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  role: Joi.string()
    .valid('user', 'admin', 'moderator')
    .optional()
    .messages({
      'any.only': 'Role must be one of: user, admin, moderator'
    })
});

const userUpdateSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .optional(),
  email: Joi.string()
    .email()
    .optional(),
  firstName: Joi.string()
    .max(50)
    .optional(),
  lastName: Joi.string()
    .max(50)
    .optional(),
  role: Joi.string()
    .valid('user', 'admin', 'moderator')
    .optional(),
  password: Joi.string().optional(),
  profile: Joi.object({
    bio: Joi.string().max(500).optional(),
    dateOfBirth: Joi.date().optional(),
    phone: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      country: Joi.string().optional()
    }).optional(),
    preferences: Joi.object({
      notifications: Joi.object({
        email: Joi.boolean().optional(),
        sms: Joi.boolean().optional(),
        push: Joi.boolean().optional()
      }).optional(),
      theme: Joi.string().valid('light', 'dark', 'auto').optional(),
      language: Joi.string().optional()
    }).optional()
  }).optional()
}).min(1);

// Order validation schemas
const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  productName: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  sku: Joi.string().optional(),
  category: Joi.string().optional(),
  attributes: Joi.object({
    size: Joi.string().optional(),
    color: Joi.string().optional(),
    weight: Joi.number().optional(),
    dimensions: Joi.object({
      length: Joi.number().optional(),
      width: Joi.number().optional(),
      height: Joi.number().optional()
    }).optional()
  }).optional()
});

const shippingAddressSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().default('US'),
  phone: Joi.string().optional(),
  instructions: Joi.string().optional()
});

const orderSchema = Joi.object({
  items: Joi.array().items(orderItemSchema).min(1).required(),
  shippingAddress: shippingAddressSchema.required(),
  billingAddress: shippingAddressSchema.optional(),
  payment: Joi.object({
    method: Joi.string()
      .valid('credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery')
      .required(),
    amount: Joi.number().min(0).required(),
    currency: Joi.string().default('USD')
  }).required(),
  shipping: Joi.object({
    method: Joi.string()
      .valid('standard', 'express', 'overnight', 'pickup')
      .default('standard'),
    cost: Joi.number().min(0).default(0)
  }).optional(),
  discount: Joi.object({
    code: Joi.string().optional(),
    amount: Joi.number().min(0).default(0),
    type: Joi.string().valid('percentage', 'fixed', 'free_shipping').optional()
  }).optional(),
  notes: Joi.string().optional(),
  customerNotes: Joi.string().optional(),
  metadata: Joi.object().optional()
});

const orderUpdateSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
    .optional(),
  items: Joi.array().items(orderItemSchema).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  billingAddress: shippingAddressSchema.optional(),
  shipping: Joi.object({
    method: Joi.string()
      .valid('standard', 'express', 'overnight', 'pickup')
      .optional(),
    cost: Joi.number().min(0).optional(),
    trackingNumber: Joi.string().optional(),
    carrier: Joi.string().optional(),
    estimatedDelivery: Joi.date().optional()
  }).optional(),
  payment: Joi.object({
    status: Joi.string()
      .valid('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')
      .optional(),
    transactionId: Joi.string().optional(),
    processedAt: Joi.date().optional(),
    failureReason: Joi.string().optional(),
    refundAmount: Joi.number().min(0).optional(),
    refundedAt: Joi.date().optional()
  }).optional(),
  notes: Joi.string().optional(),
  internalNotes: Joi.string().optional()
}).min(1);

// Payment validation schemas
const paymentIntentSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  currency: Joi.string().length(3).default('usd'),
  orderId: Joi.string().optional(),
  metadata: Joi.object().optional()
});

const paymentConfirmationSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  paymentMethodId: Joi.string().required()
});

const refundSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  amount: Joi.number().min(1).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer')
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(errorMessage, 400));
    }

    req.body = value;
    next();
  };
};

// Query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(errorMessage, 400));
    }

    req.query = value;
    next();
  };
};

// Common query schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().optional(),
  fields: Joi.string().optional()
});

const dateRangeSchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  ...paginationSchema.describe().keys
});

// Export validation middleware
module.exports = {
  validateUser: validate(userSchema),
  validateUserUpdate: validate(userUpdateSchema),
  validateOrder: validate(orderSchema),
  validateOrderUpdate: validate(orderUpdateSchema),
  validatePagination: validateQuery(paginationSchema),
  validateDateRange: validateQuery(dateRangeSchema),
  
  // Custom validation functions
  validateObjectId: (req, res, next) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length < 1) {
      return next(new AppError('Invalid ID format', 400));
    }
    next();
  },

  validateEmail: (req, res, next) => {
    const { email } = req.body;
    const emailSchema = Joi.string().email().required();
    const { error } = emailSchema.validate(email);
    
    if (error) {
      return next(new AppError('Please provide a valid email address', 400));
    }
    next();
  },

  validatePassword: (req, res, next) => {
    const { password } = req.body;
    const passwordSchema = Joi.string()
      .min(6)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
      .required();

    const { error } = passwordSchema.validate(password);

    if (error) {
      return next(new AppError('Password must be at least 6 characters long and contain at least one lowercase letter, one uppercase letter, and one number', 400));
    }
    next();
  },

  // Payment validation middleware
  validatePaymentIntent: validate(paymentIntentSchema),
  validatePaymentConfirmation: validate(paymentConfirmationSchema),
  validateRefund: validate(refundSchema)
};
