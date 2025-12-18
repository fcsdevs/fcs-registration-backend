import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods in tests
global.console = {
  ...console,
  // Keep error and warn but mock others
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Suppress pino logs in tests
process.env.LOG_LEVEL = 'silent';
