// MongoDB initialization script
db = db.getSiblingDB('order_management_db');

// Create application user
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'order_management_db'
    }
  ]
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'username', 'email'],
      properties: {
        id: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30,
          description: 'must be a string between 3-30 characters and is required'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'must be a valid email address and is required'
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin', 'moderator'],
          description: 'must be one of the enum values'
        },
        isActive: {
          bsonType: 'bool',
          description: 'must be a boolean'
        }
      }
    }
  }
});

db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'items', 'totalAmount'],
      properties: {
        id: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        userId: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
          description: 'must be one of the enum values'
        },
        totalAmount: {
          bsonType: 'number',
          minimum: 0,
          description: 'must be a positive number and is required'
        }
      }
    }
  }
});

db.createCollection('events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'type', 'data', 'metadata'],
      properties: {
        id: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        type: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        data: {
          bsonType: 'object',
          description: 'must be an object and is required'
        },
        metadata: {
          bsonType: 'object',
          required: ['timestamp', 'source'],
          description: 'must be an object with required fields'
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ 'id': 1 }, { unique: true });
db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'username': 1 }, { unique: true });
db.users.createIndex({ 'isActive': 1 });
db.users.createIndex({ 'role': 1 });

db.orders.createIndex({ 'id': 1 }, { unique: true });
db.orders.createIndex({ 'orderNumber': 1 }, { unique: true });
db.orders.createIndex({ 'userId': 1, 'createdAt': -1 });
db.orders.createIndex({ 'status': 1, 'createdAt': -1 });

db.events.createIndex({ 'id': 1 }, { unique: true });
db.events.createIndex({ 'type': 1, 'metadata.timestamp': -1 });
db.events.createIndex({ 'metadata.correlationId': 1 });
db.events.createIndex({ 'processed': 1, 'metadata.timestamp': 1 });

print('Database initialization completed successfully!');
