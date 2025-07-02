require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");

const logger = require("./config/logger");
const database = require("./config/database");
const redisConnection = require("./config/redis");
const { eventBus } = require("./events/eventBus");
const eventHandlerManager = require("./events/handlers");
const swagger = require("./config/swagger");

// Import routes
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const eventRoutes = require("./routes/eventRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// Import middleware
const { globalErrorHandler } = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

class Application {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.port = process.env.PORT || 3001;
  }

  async initialize() {
    try {
      // Connect to databases
      await database.connect();
      await redisConnection.connect();

      // Setup Express app
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();

      // Setup Socket.IO
      this.setupSocketIO();

      // Initialize event bus
      await eventBus.initialize();

      // Initialize event handlers
      await eventHandlerManager.initialize();

      logger.info("Application initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize application:", error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || [
          "http://localhost:3000",
          "http://localhost:5173",
        ],
        credentials: true,
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Logging middleware
    this.app.use(
      morgan("combined", {
        stream: {
          write: (message) => logger.http(message.trim()),
        },
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
      });
    });

    // API Documentation
    this.app.use(
      "/api-docs",
      swagger.serve,
      swagger.setup(swagger.specs, {
        explorer: true,
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Real-time Order Management System API Documentation",
      })
    );

    // API routes
    this.app.use("/api/users", userRoutes);
    this.app.use("/api/orders", orderRoutes);
    this.app.use("/api/events", eventRoutes);
    this.app.use("/api/payments", paymentRoutes);
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(globalErrorHandler);
  }

  setupSocketIO() {
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on("disconnect", () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });

      // Join room for real-time updates
      socket.on("join-room", (room) => {
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
      });
    });

    // Make io available globally for event broadcasting
    global.io = this.io;
  }

  async start() {
    try {
      await this.initialize();

      this.server.listen(this.port, () => {
        logger.info(
          `Server running on port ${this.port} in ${
            process.env.NODE_ENV || "development"
          } mode`
        );
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close server
        if (this.server) {
          this.server.close(() => {
            logger.info("HTTP server closed");
          });
        }

        // Close database connections
        await database.disconnect();
        await redisConnection.disconnect();

        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  logger.error("Failed to start application:", error);
  process.exit(1);
});

module.exports = app;
