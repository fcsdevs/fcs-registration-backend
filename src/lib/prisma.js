import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino();

let prisma;

export const getPrismaClient = () => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    prisma.$on('query', (e) => {
      logger.debug(`Query: ${e.query}`);
      logger.debug(`Params: ${e.params}`);
      logger.debug(`Duration: ${e.duration}ms`);
    });

    prisma.$on('error', (e) => {
      logger.error(`Prisma Error: ${e.message}`);
    });

    prisma.$on('warn', (e) => {
      logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  return prisma;
};

export const disconnectPrisma = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

export default getPrismaClient;
