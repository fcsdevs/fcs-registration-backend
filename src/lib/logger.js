import pino from 'pino';

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Centralized logger configuration
 */
const logger = NODE_ENV === 'development'
  ? pino({
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
    })
  : pino({
      level: process.env.LOG_LEVEL || 'info',
    });

export default logger;
