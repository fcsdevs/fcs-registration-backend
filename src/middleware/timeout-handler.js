import pino from 'pino';
import { AppError } from './error-handler.js';

const logger = pino();

/**
 * Request timeout middleware
 * Sets timeout for all requests and handles timeout errors
 */
export const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      logger.warn({
        type: 'REQUEST_TIMEOUT',
        ip: req.ip || req.connection.remoteAddress,
        path: req.path,
        method: req.method,
        timeoutMs,
        timestamp: new Date().toISOString(),
      });

      if (!res.headersSent) {
        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout - the server took too long to respond',
            status: 408,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }, timeoutMs);

    // Clear timeout on response finish
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Socket timeout middleware for long-running requests
 */
export const socketTimeout = (timeoutMs = 60000) => {
  return (req, res, next) => {
    req.socket.setTimeout(timeoutMs, () => {
      logger.warn({
        type: 'SOCKET_TIMEOUT',
        ip: req.ip || req.connection.remoteAddress,
        path: req.path,
        method: req.method,
        timeoutMs,
        timestamp: new Date().toISOString(),
      });
    });

    next();
  };
};

/**
 * Timeout error handler for async operations
 */
export const withTimeout = async (promise, timeoutMs = 30000, timeoutMessage = 'Operation timeout') => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(timeoutMessage, 408, 'REQUEST_TIMEOUT'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]);
};

export default requestTimeout;
