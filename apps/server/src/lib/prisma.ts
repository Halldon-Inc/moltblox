import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

console.log('[BOOT] Initializing Prisma client...');

const connectionString =
  process.env.DATABASE_URL ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] DATABASE_URL must be set in production');
      throw new Error('FATAL: DATABASE_URL must be set in production');
    }
    console.warn('[BOOT] DATABASE_URL not set — using empty connection string (dev mode)');
    return '';
  })();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  try {
    const adapter = new PrismaPg({ connectionString });
    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    console.log('[BOOT] Prisma client created successfully');
    return client;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[FATAL] Failed to create Prisma client:', msg);
    throw err;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
