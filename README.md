# Real-time Order Management System

A comprehensive real-time order management system built with modern microservice architecture and event-driven capabilities, featuring Node.js, React, MongoDB, and Redis.

## 🏗️ Architecture Overview

This project showcases a complete real-time order management system featuring:

- **Event-Driven Architecture**: Real-time event publishing and subscription system
- **Microservice Backend**: RESTful API with comprehensive business logic
- **React Frontend**: Modern, responsive user interface with real-time updates
- **Database Integration**: MongoDB with optimized schemas and indexing
- **Caching Layer**: Redis for performance optimization and event distribution
- **Real-time Communication**: WebSocket integration for live updates
- **Comprehensive Testing**: Unit, integration, and component tests
- **API Documentation**: OpenAPI/Swagger documentation
- **Containerization**: Docker and Docker Compose for easy deployment

## 🚀 Features

### Backend Features
- **User Management**: Registration, authentication, profile management
- **Order Processing**: Complete order lifecycle management
- **Event System**: Publish/subscribe event architecture with retry mechanisms
- **Real-time Updates**: WebSocket support for live notifications
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Logging**: Structured logging with different levels
- **Rate Limiting**: API rate limiting for security
- **Health Checks**: System health monitoring endpoints

### Frontend Features
- **Modern React**: Built with React 18 and TypeScript
- **Real-time UI**: Live updates via WebSocket connections
- **Responsive Design**: Mobile-first responsive design with Tailwind CSS
- **State Management**: Context API for global state management
- **Form Validation**: Client-side validation with user-friendly error messages
- **Notifications**: Toast notifications for user feedback
- **Dashboard**: Comprehensive user dashboard with statistics

### Event System Features
- **Event Store**: Persistent event storage with MongoDB
- **Event Bus**: In-memory event distribution with Redis pub/sub
- **Event Handlers**: Modular event handlers with retry logic
- **Event Replay**: Ability to replay events for debugging
- **Event Monitoring**: Real-time event monitoring and statistics
- **Correlation Tracking**: Event correlation for distributed tracing

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT tokens
- **Validation**: Joi
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Real-time**: Socket.IO client
- **Testing**: Vitest + React Testing Library
- **State Management**: React Context API

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (for production)
- **Process Management**: PM2 (optional)
- **Monitoring**: Health checks and logging

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **MongoDB** (if running locally)
- **Redis** (if running locally)

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd realtime-order-management-system
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api-docs

### Local Development Setup

1. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration

   # Frontend
   cp frontend/.env.example frontend/.env
   # Edit frontend/.env with your configuration
   ```

3. **Start services**
   ```bash
   # Start MongoDB and Redis (using Docker)
   docker-compose up -d mongodb redis

   # Start backend
   cd backend
   npm run dev

   # Start frontend (in another terminal)
   cd frontend
   npm run dev
   ```

## 📚 API Documentation

The API is fully documented using OpenAPI/Swagger. Once the backend is running, visit:
- **Swagger UI**: http://localhost:3001/api-docs

### Key API Endpoints

#### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login

#### User Management
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update user profile
- `DELETE /api/users/profile` - Delete user account

#### Order Management
- `POST /api/orders` - Create new order
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get specific order
- `PATCH /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Cancel order

#### Event System
- `GET /api/events` - Get events (with pagination)
- `GET /api/events/stats` - Get event statistics
- `GET /api/events/health` - Event system health check

## 🧪 Testing

### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔧 Configuration

### Environment Variables

#### Root Directory (.env) - Docker Compose
```env
# Application Environment
NODE_ENV=development

# Database Configuration
MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=secure_mongo_password_change_in_production
MONGODB_DATABASE=order_management_db

# Redis Configuration
REDIS_PASSWORD=secure_redis_password_change_in_production

# Security Keys (CHANGE ALL OF THESE IN PRODUCTION)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars-required
ENCRYPTION_KEY=your-32-char-encryption-key-change-in-production-required
API_KEY_SECRET=your-api-key-secret-change-in-production-required
SESSION_SECRET=your-session-secret-change-in-production-min-32-chars-required
```

#### Backend (.env)
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/order_management_db
MONGODB_USERNAME=admin
MONGODB_PASSWORD=dev_password_123
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dev_redis_password_123
JWT_SECRET=dev-jwt-secret-key-for-development-only-32-chars-minimum
ENCRYPTION_KEY=dev-encryption-key-32-chars-min
API_KEY_SECRET=dev-api-key-secret-for-development
SESSION_SECRET=dev-session-secret-for-development-only-32-chars-minimum
CORS_ORIGIN=http://localhost:3000
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
VITE_APP_NAME=Real-time Order Management System
VITE_ENABLE_DEBUG=true
```

## 🔒 Security

### Environment Variables & Secrets Management
All sensitive data is managed through environment variables:

- **Database credentials**: MongoDB username/password
- **Redis authentication**: Redis password
- **JWT secrets**: Token signing and verification
- **Encryption keys**: Data encryption at rest
- **API keys**: External service authentication
- **Session secrets**: Session management

### Security Features
- **Password hashing**: bcrypt with configurable salt rounds
- **JWT authentication**: Secure token-based authentication
- **Data encryption**: AES-256-GCM for sensitive data
- **Rate limiting**: Configurable request rate limiting
- **CORS protection**: Cross-origin request security
- **Security headers**: XSS, CSRF, and other attack prevention
- **Input validation**: Comprehensive data validation
- **SQL injection prevention**: MongoDB ODM protection

### Production Security Checklist
- [ ] Change all default passwords and secrets
- [ ] Use strong, unique passwords (32+ characters)
- [ ] Enable HTTPS/TLS encryption
- [ ] Configure proper CORS origins
- [ ] Set up proper firewall rules
- [ ] Enable database authentication
- [ ] Use environment-specific configurations
- [ ] Regular security updates and patches

## 📊 Monitoring and Health Checks

### Health Check Endpoints
- **Backend**: `GET /health`
- **Event System**: `GET /api/events/health`
- **Database**: Automatic health checks in Docker Compose

### Logging
- **Backend logs**: `backend/logs/`
- **Event logs**: Structured logging with correlation IDs
- **Error tracking**: Centralized error handling and logging

## 🔄 Event System

### Event Types
- **User Events**: `user.created`, `user.updated`, `user.deleted`, `user.login`
- **Order Events**: `order.created`, `order.updated`, `order.cancelled`, `order.completed`
- **System Events**: `system.startup`, `system.shutdown`, `system.error`

### Event Flow
1. **Event Publishing**: Services publish events to the event bus
2. **Event Storage**: Events are persisted to MongoDB
3. **Event Distribution**: Redis pub/sub distributes events to subscribers
4. **Event Handling**: Registered handlers process events asynchronously
5. **Real-time Updates**: WebSocket clients receive relevant events

## 🚀 Deployment

### Production Deployment with Docker

1. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.yml --profile production up -d
   ```

2. **Environment Configuration**
   - Update environment variables for production
   - Configure SSL certificates for HTTPS
   - Set up proper database credentials
   - Configure monitoring and logging

### Scaling Considerations
- **Horizontal Scaling**: Multiple backend instances behind load balancer
- **Database Scaling**: MongoDB replica sets or sharding
- **Cache Scaling**: Redis clustering
- **Event Processing**: Distributed event handlers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies and best practices
- Inspired by microservice architecture patterns
- Designed for educational and demonstration purposes

## 📞 Support

For questions and support, please open an issue in the repository or contact the development team.

---

**Happy Coding! 🚀**
