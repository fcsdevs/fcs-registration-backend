import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import pino from 'pino';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import middleware
import { errorHandler } from './middleware/error-handler.js';
import { requestValidator } from './middleware/request-validator.js';
import { createRateLimiters } from './middleware/rate-limit-handler.js';
import { requestTimeout, socketTimeout } from './middleware/timeout-handler.js';

// Import routes
import authRoutes from './modules/auth/routes.js';
import memberRoutes from './modules/members/routes.js';
import eventRoutes from './modules/events/routes.js';
import registrationRoutes from './modules/registrations/routes.js';
import attendanceRoutes from './modules/attendance/routes.js';
import centerRoutes from './modules/centers/routes.js';
import reportRoutes from './modules/reports/routes.js';
import auditRoutes from './modules/audit/routes.js';
import groupRoutes from './modules/groups/routes.js';
import unitRoutes from './modules/units/routes.js';
import roleRoutes from './modules/roles/routes.js';
import notificationRoutes from './modules/notifications/routes.js';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger setup
const logger = NODE_ENV === 'development'
  ? pino(
      {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    )
  : pino({
      level: process.env.LOG_LEVEL || 'info',
    });

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// Timeout middleware
app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000')));
app.use(socketTimeout(parseInt(process.env.SOCKET_TIMEOUT_MS || '60000')));

// Rate limiting with custom error handling
const { apiLimiter, authLimiter } = createRateLimiters();
app.use('/api/', apiLimiter);

// Request logging
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request validation middleware
app.use(requestValidator);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API Routes
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/members', memberRoutes);
apiRouter.use('/events', eventRoutes);
apiRouter.use('/registrations', registrationRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/centers', centerRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/groups', groupRoutes);
apiRouter.use('/units', unitRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/notifications', notificationRoutes);

app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(
    `🚀 FCS Registration API Server running on port ${PORT} in ${NODE_ENV} mode`
  );
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Unhandled exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
