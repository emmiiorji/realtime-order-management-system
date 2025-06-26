const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Real-time Order Management System API',
      version: '1.0.0',
      description: 'A comprehensive API for a real-time order management system with event-driven architecture and live updates',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['username', 'email'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the user',
              example: 'user_123456789',
            },
            username: {
              type: 'string',
              description: 'Unique username',
              minLength: 3,
              maxLength: 30,
              example: 'johndoe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'moderator'],
              description: 'User role',
              example: 'user',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user account is active',
              example: true,
            },
            isEmailVerified: {
              type: 'boolean',
              description: 'Whether the user email is verified',
              example: false,
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp',
              example: '2023-12-01T10:30:00Z',
            },
            profile: {
              type: 'object',
              properties: {
                avatar: {
                  type: 'string',
                  description: 'Avatar URL',
                },
                bio: {
                  type: 'string',
                  maxLength: 500,
                  description: 'User biography',
                },
                dateOfBirth: {
                  type: 'string',
                  format: 'date',
                  description: 'Date of birth',
                },
                phone: {
                  type: 'string',
                  description: 'Phone number',
                },
                address: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zipCode: { type: 'string' },
                    country: { type: 'string' },
                  },
                },
                preferences: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'object',
                      properties: {
                        email: { type: 'boolean', default: true },
                        sms: { type: 'boolean', default: false },
                        push: { type: 'boolean', default: true },
                      },
                    },
                    theme: {
                      type: 'string',
                      enum: ['light', 'dark', 'auto'],
                      default: 'auto',
                    },
                    language: {
                      type: 'string',
                      default: 'en',
                    },
                  },
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
              example: '2023-11-01T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2023-12-01T10:30:00Z',
            },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 30,
              pattern: '^[a-zA-Z0-9]+$',
              example: 'johndoe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])',
              description: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
              example: 'Password123',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
            password: {
              type: 'string',
              example: 'Password123',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the order',
              example: 'order_123456789',
            },
            orderNumber: {
              type: 'string',
              description: 'Human-readable order number',
              example: '2023120100001',
            },
            userId: {
              type: 'string',
              description: 'ID of the user who placed the order',
              example: 'user_123456789',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
              description: 'Current order status',
              example: 'pending',
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderItem',
              },
            },
            subtotal: {
              type: 'number',
              minimum: 0,
              description: 'Subtotal amount before tax and shipping',
              example: 99.99,
            },
            tax: {
              type: 'number',
              minimum: 0,
              description: 'Tax amount',
              example: 8.00,
            },
            shipping: {
              type: 'object',
              properties: {
                cost: {
                  type: 'number',
                  minimum: 0,
                  example: 9.99,
                },
                method: {
                  type: 'string',
                  enum: ['standard', 'express', 'overnight', 'pickup'],
                  example: 'standard',
                },
                estimatedDelivery: {
                  type: 'string',
                  format: 'date-time',
                },
                trackingNumber: {
                  type: 'string',
                },
                carrier: {
                  type: 'string',
                },
              },
            },
            discount: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  minimum: 0,
                  example: 10.00,
                },
                code: {
                  type: 'string',
                  example: 'SAVE10',
                },
                type: {
                  type: 'string',
                  enum: ['percentage', 'fixed', 'free_shipping'],
                },
              },
            },
            totalAmount: {
              type: 'number',
              minimum: 0,
              description: 'Total order amount',
              example: 107.98,
            },
            currency: {
              type: 'string',
              default: 'USD',
              example: 'USD',
            },
            shippingAddress: {
              $ref: '#/components/schemas/Address',
            },
            billingAddress: {
              $ref: '#/components/schemas/Address',
            },
            payment: {
              type: 'object',
              properties: {
                method: {
                  type: 'string',
                  enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery'],
                  example: 'credit_card',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
                  example: 'pending',
                },
                transactionId: {
                  type: 'string',
                },
                amount: {
                  type: 'number',
                  minimum: 0,
                  example: 107.98,
                },
                currency: {
                  type: 'string',
                  default: 'USD',
                },
                processedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                failureReason: {
                  type: 'string',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-12-01T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-12-01T10:30:00Z',
            },
          },
        },
        OrderItem: {
          type: 'object',
          required: ['productId', 'productName', 'quantity', 'unitPrice'],
          properties: {
            productId: {
              type: 'string',
              example: 'prod_123456789',
            },
            productName: {
              type: 'string',
              example: 'Wireless Headphones',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
              example: 2,
            },
            unitPrice: {
              type: 'number',
              minimum: 0,
              example: 49.99,
            },
            totalPrice: {
              type: 'number',
              minimum: 0,
              example: 99.98,
            },
            sku: {
              type: 'string',
              example: 'WH-001',
            },
            category: {
              type: 'string',
              example: 'Electronics',
            },
          },
        },
        Address: {
          type: 'object',
          required: ['firstName', 'lastName', 'street', 'city', 'state', 'zipCode', 'country'],
          properties: {
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            street: {
              type: 'string',
              example: '123 Main St',
            },
            city: {
              type: 'string',
              example: 'New York',
            },
            state: {
              type: 'string',
              example: 'NY',
            },
            zipCode: {
              type: 'string',
              example: '10001',
            },
            country: {
              type: 'string',
              default: 'US',
              example: 'US',
            },
            phone: {
              type: 'string',
              example: '+1-555-123-4567',
            },
            instructions: {
              type: 'string',
              example: 'Leave at front door',
            },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the event',
              example: 'evt_123456789',
            },
            type: {
              type: 'string',
              description: 'Event type',
              example: 'user.created',
            },
            data: {
              type: 'object',
              description: 'Event payload data',
            },
            metadata: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2023-12-01T10:30:00Z',
                },
                source: {
                  type: 'string',
                  example: 'microservice',
                },
                version: {
                  type: 'string',
                  example: '1.0.0',
                },
                correlationId: {
                  type: 'string',
                },
                causationId: {
                  type: 'string',
                },
                userId: {
                  type: 'string',
                },
              },
            },
            processed: {
              type: 'boolean',
              description: 'Whether the event has been processed',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-12-01T10:30:00Z',
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success', 'error'],
              example: 'success',
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1,
                },
                limit: {
                  type: 'integer',
                  example: 10,
                },
                total: {
                  type: 'integer',
                  example: 100,
                },
                pages: {
                  type: 'integer',
                  example: 10,
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['error', 'fail'],
              example: 'error',
            },
            message: {
              type: 'string',
              example: 'An error occurred',
            },
            errors: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Field is required', 'Invalid format'],
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Orders',
        description: 'Order management operations',
      },
      {
        name: 'Events',
        description: 'Event system monitoring and management',
      },
      {
        name: 'System',
        description: 'System health and monitoring',
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Real-time Order Management System API Documentation',
  }),
};
