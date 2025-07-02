// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test_jwt_secret_1234567890_abcdef';
process.env.ENCRYPTION_KEY = 'test_encryption_key_1234567890_abcdef';
process.env.SESSION_SECRET = 'test_session_secret_1234567890_abcdef';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_webhook_secret';
process.env.FRONTEND_URL = 'http://localhost:3000';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

let mongoServer;

// Mock Redis connection
jest.mock('../config/redis', () => ({
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  getClient: jest.fn().mockReturnValue({
    isReady: true,
    on: jest.fn(),
    off: jest.fn(),
  }),
  getPublisher: jest.fn().mockReturnValue({
    publish: jest.fn().mockResolvedValue(),
  }),
  getSubscriber: jest.fn().mockReturnValue({
    subscribe: jest.fn().mockResolvedValue(),
    unsubscribe: jest.fn().mockResolvedValue(),
  }),
}));

// Mock event bus - but don't mock it globally since we want to test the actual EventBus class
// Individual tests can mock specific dependencies as needed

// Mock logger
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Global test setup
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set the MongoDB URI for tests
  process.env.MONGODB_URI = mongoUri;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Cleanup test database and stop MongoDB instance
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  
  // Hash the password properly for the seeded user
  const hashedPassword = await bcrypt.hash('Password123', 10);
  
  await User.create({
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    password: hashedPassword,
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
    isEmailVerified: false,
    profile: {
      preferences: {
        notifications: { email: true, sms: false, push: true },
        theme: 'auto',
        language: 'en',
      },
    },
    metadata: {
      createdBy: 'system',
      updatedBy: 'system',
      tags: [],
    },
  });
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  createMockOrder: () => ({
    id: 'order-123',
    orderNumber: 'ORD-001',
    userId: 'test-user-123',
    items: [
      {
        productId: 'prod-123',
        name: 'Test Product',
        quantity: 2,
        unitPrice: 10.00,
        totalPrice: 20.00,
        sku: 'TEST-SKU-001'
      }
    ],
    subtotal: 20.00,
    tax: 1.60,
    totalAmount: 21.60,
    status: 'pending',
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
      amount: 21.60,
      currency: 'USD',
      status: 'pending'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  createMockPaymentIntent: () => ({
    id: 'pi_test123',
    amount: 2000,
    currency: 'usd',
    status: 'requires_payment_method',
    client_secret: 'pi_test123_secret',
    metadata: {
      userId: 'test-user-123',
      orderId: 'order-123'
    }
  }),

  expectEventToBePublished: (mockEventBus, eventType, expectedData) => {
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      eventType,
      expect.objectContaining(expectedData),
      expect.any(Object)
    );
  }
};
