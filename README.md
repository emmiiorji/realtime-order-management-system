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
- **Order Processing**: Complete order lifecycle management with inventory integration
- **Payment Processing**: Full Stripe integration with payment intents, confirmations, and refunds
- **Event System**: Publish/subscribe event architecture with retry mechanisms and correlation tracking
- **Real-time Updates**: WebSocket support for live notifications and order status updates
- **Data Validation**: Comprehensive input validation and sanitization with Joi schemas
- **Error Handling**: Centralized error handling with proper HTTP status codes and user-friendly messages
- **Webhook Processing**: Secure Stripe webhook handling for payment events
- **Logging**: Structured logging with different levels and correlation IDs
- **Rate Limiting**: API rate limiting for security and abuse prevention
- **Health Checks**: System health monitoring endpoints with detailed status information

### Frontend Features (Minimal Styling)
- **Modern React**: Built with React 18 and TypeScript with latest best practices
- **Payment Integration**: Complete Stripe Elements integration with payment forms and status displays
- **Order Management**: Comprehensive order creation, tracking, and management interface
- **Real-time UI**: Live updates via WebSocket connections for order and payment status
- **Responsive Design**: Mobile-first responsive design with custom CSS and dark mode support
- **State Management**: Context API for global state management with optimistic updates
- **Form Validation**: Client-side validation with user-friendly error messages and real-time feedback
- **Payment Security**: Secure payment processing with PCI-compliant Stripe integration
- **Notifications**: Toast notifications for user feedback and real-time event updates
- **Dashboard**: Comprehensive user dashboard with order statistics and payment history

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
- **Authentication**: JWT tokens with secure session management
- **Payment Processing**: Stripe SDK for secure payment handling
- **Validation**: Joi with comprehensive schema validation
- **Testing**: Jest with extensive unit, integration, and e2e test coverage
- **Documentation**: Swagger/OpenAPI with comprehensive API documentation
- **Logging**: Winston with structured logging and correlation tracking

### Frontend
- **Framework**: React 18 with TypeScript and modern hooks
- **Build Tool**: Vite with optimized build configuration
- **Styling**: Custom CSS with responsive design and dark mode support
- **Payment UI**: Stripe Elements for secure payment forms
- **HTTP Client**: Axios with interceptors and error handling
- **Real-time**: Socket.IO client for live updates
- **Testing**: Vitest + React Testing Library with comprehensive test coverage
- **State Management**: React Context API with optimistic updates

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (for production)
- **Process Management**: PM2 (optional)
- **Monitoring**: Health checks and logging

## 📋 Prerequisites

### For Local Development
- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **MongoDB** (if running locally)
- **Redis** (if running locally)

### For Cloud Deployment (e.g Render)
- **GitHub/GitLab** account with your code repository
- **External MongoDB** database (MongoDB Atlas, DigitalOcean, etc.)
- **Stripe** account for payment processing
- **Render** account for deployment

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
- `GET /api/orders/my-orders` - Get user's orders with pagination and filtering
- `GET /api/orders/:id` - Get specific order details
- `PATCH /api/orders/:id` - Update order information
- `DELETE /api/orders/:id` - Cancel order with reason
- `GET /api/orders/:id/tracking` - Get order tracking information
- `GET /api/orders/stats` - Get order statistics and analytics

#### Payment Processing
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/confirm` - Confirm payment with payment method
- `GET /api/payments/payment-methods/:customerId` - Get saved payment methods
- `POST /api/payments/save-payment-method` - Save payment method for future use
- `POST /api/payments/refund` - Process payment refund
- `GET /api/payments/history/:customerId` - Get payment history
- `POST /api/payments/webhook` - Stripe webhook endpoint for payment events

#### Event System
- `GET /api/events` - Get events (with pagination and filtering)
- `GET /api/events/stats` - Get event statistics and metrics
- `GET /api/events/health` - Event system health check and status

## 🧪 Testing

This project includes comprehensive testing with **100+ test cases** covering payment processing, order management, and event handling across both frontend and backend.

### Comprehensive Test Suite
```bash
# Run all tests (backend + frontend + integration)
npm test

# Run only backend tests
npm run test:backend

# Run only frontend tests
npm run test:frontend

# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests only
npm run test:coverage      # All tests with coverage reports

# Watch mode for development
npm run test:watch
```

### Test Coverage Areas
- ✅ **Payment Processing**: Stripe integration, payment intents, confirmations, refunds, webhooks
- ✅ **Order Management**: Order creation, updates, cancellation, tracking, validation
- ✅ **Event System**: Event publishing, handling, correlation, error recovery
- ✅ **API Endpoints**: Request/response validation, authentication, error handling
- ✅ **Frontend Components**: Payment forms, order forms, status displays, user interactions
- ✅ **Integration Flows**: Complete order-to-payment workflows, error scenarios
- ✅ **Real-time Features**: WebSocket connections, live updates, event notifications

### Backend Tests (60+ test cases)
```bash
cd backend

# Unit tests - Controllers, services, utilities
npm run test:unit

# Integration tests - API routes, database operations
npm run test:integration

# Coverage report
npm run test:coverage
```

### Frontend Tests (40+ test cases)
```bash
cd frontend

# Unit tests - Services, utilities, hooks
npm run test:unit

# Component tests - React components, user interactions
npm run test:components

# Integration tests - Service integration, API calls
npm run test:integration

# End-to-end tests - Complete user workflows
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Test Categories

#### Payment Processing Tests
- Payment intent creation and validation
- Payment confirmation with Stripe Elements
- Payment method management and saving
- Refund processing and webhook handling
- Error scenarios and edge cases
- Payment form interactions and validation

#### Order Management Tests
- Order creation with validation
- Order lifecycle management
- Order-payment integration
- Inventory updates and event handling
- Order tracking and status updates
- Error handling and recovery

#### Event System Tests
- Event publishing and subscription
- Event correlation and causation tracking
- Cross-system event integration
- Event retry mechanisms and error handling
- Real-time event distribution
- Performance and concurrency testing

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

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
VITE_APP_NAME=Real-time Order Management System
VITE_ENABLE_DEBUG=true

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
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
- **Order Events**: `order.created`, `order.updated`, `order.cancelled`, `order.completed`, `order.shipped`, `order.delivered`
- **Payment Events**: `order.payment.processed`, `order.payment.failed`, `order.payment.refunded`
- **Inventory Events**: `inventory.updated`, `inventory.low_stock`, `inventory.out_of_stock`
- **System Events**: `system.startup`, `system.shutdown`, `system.error`, `system.health_check`

### Event Flow
1. **Event Publishing**: Services publish events to the event bus
2. **Event Storage**: Events are persisted to MongoDB
3. **Event Distribution**: Redis pub/sub distributes events to subscribers
4. **Event Handling**: Registered handlers process events asynchronously
5. **Real-time Updates**: WebSocket clients receive relevant events

## 🚀 Deployment

### Cloud Deployment (e.g Render)

Deploy to Render using the included Blueprint configuration for a fully managed cloud deployment.

1. **Prerequisites**
   - Push your code to GitHub/GitLab
   - Set up external MongoDB database (MongoDB Atlas, DigitalOcean, etc.)
   - The Blueprint will create a managed Redis service automatically

2. **Deploy with Blueprint**
   ```bash
   # Your render.yaml file is already configured
   # Just deploy via Render dashboard:
   # 1. Go to Render Dashboard
   # 2. Click "New" → "Blueprint"
   # 3. Connect your repository
   # 4. Render auto-detects render.yaml
   # 5. Click "Apply"
   ```

3. **Environment Configuration**
   Set these environment variables in Render dashboard:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/order_management_db
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   ENCRYPTION_KEY=your-32-char-encryption-key
   API_KEY_SECRET=your-api-key-secret
   SESSION_SECRET=your-session-secret-min-32-chars
   STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

4. **Services Created**
   - **Backend**: Node.js API service (private)
   - **Frontend**: React static site (public)
   - **Redis**: Managed Redis cache service

📖 **Detailed Guide**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for complete setup instructions.

### Local Development with Docker

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

## 🔮 Future Improvements

### UI/UX Enhancements
- **Responsive Design**: Improve mobile and tablet responsiveness
- **Customizable UI**: Allow users to customize their dashboard and settings
- **Advanced Dashboard**: Enhanced analytics with charts and data visualizations
- **Mobile App**: Native mobile application for iOS and Android
- **Improved Accessibility**: WCAG 2.1 compliance and screen reader support
- **Theme Customization**: Multiple theme options and user preferences

### Technical Enhancements
- **Microservice Architecture**: Split into smaller, focused services
- **Advanced Caching**: Implement Redis clusters and CDN integration
- **Real-time Analytics**: Live reporting and business intelligence features
- **Enhanced Security**: OAuth2, multi-factor authentication, and audit logging

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
