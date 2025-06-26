const mongoose = require('mongoose');
const logger = require('./logger');

class DatabaseConnection {
  constructor() {
    this.connection = null;
  }

  buildMongoUri() {
    // Check if full URI is provided
    if (process.env.MONGODB_URI) {
      return process.env.MONGODB_URI;
    }

    // Build URI from individual components
    const username = process.env.MONGODB_USERNAME || '';
    const password = process.env.MONGODB_PASSWORD || '';
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || '27017';
    const database = process.env.MONGODB_DATABASE || 'order_management_db';

    let uri = 'mongodb://';

    if (username && password) {
      uri += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
    }

    uri += `${host}:${port}/${database}`;

    if (username && password) {
      uri += '?authSource=admin';
    }

    return uri;
  }

  async connect() {
    try {
      // Build MongoDB URI from environment variables
      const mongoUri = this.buildMongoUri();
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        authSource: 'admin'
      };

      this.connection = await mongoose.connect(mongoUri, options);
      
      logger.info('Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new DatabaseConnection();
