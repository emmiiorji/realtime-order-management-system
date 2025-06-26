// Test setup file
const mongoose = require('mongoose');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test_jwt_secret';

// Global test setup
beforeAll(async () => {
  // Setup test database connection if needed
  // await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  // Cleanup test database if needed
  // await mongoose.connection.close();
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
