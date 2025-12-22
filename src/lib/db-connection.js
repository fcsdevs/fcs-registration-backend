import { getPrismaClient } from './prisma.js';
import logger from './logger.js';

const prisma = getPrismaClient();

/**
 * Test database connection with retries
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function testDatabaseConnection(maxRetries = 5, delayMs = 3000) {
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    
    try {
      logger.info(`🔌 Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      
      // Try a simple query to test connection
      await prisma.$queryRaw`SELECT 1`;
      
      logger.info('✅ Database connection successful!');
      logger.info(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown'}`);
      
      return true;
    } catch (error) {
      logger.warn(`❌ Database connection failed (attempt ${attempt}/${maxRetries})`);
      logger.warn(`Error: ${error.message}`);
      
      if (attempt < maxRetries) {
        logger.info(`⏳ Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        logger.error('💥 Failed to connect to database after maximum retries');
        logger.error('Please check:');
        logger.error('  1. DATABASE_URL is correct in .env file');
        logger.error('  2. Database server is running and accessible');
        logger.error('  3. Network connection is stable');
        logger.error('  4. For Neon databases, check if it\'s paused in the dashboard');
        
        throw new Error('Database connection failed after maximum retries');
      }
    }
  }
  
  return false;
}

/**
 * Check if database tables exist
 * @returns {Promise<boolean>}
 */
export async function checkDatabaseTables() {
  try {
    logger.info('🔍 Checking if database tables exist...');
    
    // Try to query a main table
    await prisma.authUser.findFirst();
    
    logger.info('✅ Database tables are ready!');
    return true;
  } catch (error) {
    if (error.code === 'P2021') {
      logger.warn('⚠️  Database tables do not exist!');
      logger.warn('Please run: npx prisma migrate dev');
      return false;
    }
    
    logger.error('❌ Error checking database tables:', error.message);
    throw error;
  }
}

/**
 * Initialize database connection
 * Verifies connection and checks if migrations are needed
 */
export async function initializeDatabase() {
  try {
    // Test connection with retries
    await testDatabaseConnection(5, 3000);
    
    // Check if tables exist
    const tablesExist = await checkDatabaseTables();
    
    if (!tablesExist) {
      logger.warn('⚠️  Run migrations before starting the server:');
      logger.warn('   npx prisma migrate dev');
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database tables not found in production environment');
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize database:', error.message);
    throw error;
  }
}

export default { testDatabaseConnection, checkDatabaseTables, initializeDatabase };
