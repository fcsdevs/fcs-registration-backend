import rateLimit from 'express-rate-limit';
import pino from 'pino';

const logger = pino();

/**
 * Custom rate limit error handler
 */
export const rateLimitErrorHandler = (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  logger.warn({
    type: 'RATE_LIMIT_EXCEEDED',
    ip: clientIp,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      status: 429,
      retryAfter: req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime * 1000).toISOString() : null,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Create rate limiters for different endpoints
 */
export const createRateLimiters = () => {
  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP',
    standardHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health check
      return req.path === '/health';
    },
    handler: rateLimitErrorHandler,
  });

  // Strict limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5'),
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts',
    handler: rateLimitErrorHandler,
  });

  // Loose limiter for read-only endpoints
  const readLimiter = rateLimit({
    windowMs: parseInt(process.env.READ_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.READ_RATE_LIMIT_MAX_REQUESTS || '1000'),
    message: 'Too many read requests',
    handler: rateLimitErrorHandler,
  });

  return { apiLimiter, authLimiter, readLimiter };
};

export default createRateLimiters;
