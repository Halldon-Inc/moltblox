/**
 * Moltblox API Server — Bootstrap Entry Point
 *
 * This file registers crash handlers and validates environment BEFORE
 * loading any app modules. All app code is loaded via dynamic import()
 * so that errors during module loading (missing env vars, Prisma client
 * not generated, etc.) are caught and logged instead of silently crashing.
 */

import type { Express } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Redis } from 'ioredis';
import type { Server as HTTPServer } from 'http';
import type { WebSocketServer } from 'ws';

// -------------------------------------------------------
// 1. Register crash handlers FIRST — before ANY module loading
// -------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

console.log('[BOOT] Starting Moltblox API server...');
console.log(
  `[BOOT] Node ${process.version} | PID ${process.pid} | ENV ${process.env.NODE_ENV || 'development'}`,
);

// -------------------------------------------------------
// 2. Validate required environment variables early
// -------------------------------------------------------
const REQUIRED_ENV: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

const OPTIONAL_ENV: Record<string, string | undefined> = {
  REDIS_URL: process.env.REDIS_URL,
  SENTRY_DSN: process.env.SENTRY_DSN,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  MOLTBOOK_APP_KEY: process.env.MOLTBOOK_APP_KEY,
  MOLTBOOK_API_URL: process.env.MOLTBOOK_API_URL,
};

if (process.env.NODE_ENV === 'production') {
  const missing = Object.entries(REQUIRED_ENV)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[FATAL] Server cannot start without these. Exiting.');
    process.exit(1);
  }
}

// Log which env vars are set (values redacted for security)
console.log('[BOOT] Environment variables:');
for (const [key, val] of Object.entries({ ...REQUIRED_ENV, ...OPTIONAL_ENV })) {
  console.log(`[BOOT]   ${key}: ${val ? 'SET' : 'NOT SET'}`);
}

// -------------------------------------------------------
// 3. Dynamic import of app modules — errors are caught
//    by the crash handlers registered above
// -------------------------------------------------------
async function boot(): Promise<void> {
  console.log('[BOOT] Loading modules...');

  const { createServer } = await import('http');

  const appModule = await import('./app.js');
  const app = appModule.default as unknown as Express;
  console.log('[BOOT] Express app loaded');

  const wsModule = await import('./ws/index.js');
  const createWebSocketServer = wsModule.createWebSocketServer as unknown as (
    server: HTTPServer,
  ) => WebSocketServer;
  console.log('[BOOT] WebSocket module loaded');

  const prismaModule = await import('./lib/prisma.js');
  const prisma = prismaModule.default as unknown as PrismaClient;
  console.log('[BOOT] Prisma client loaded');

  const redisModule = await import('./lib/redis.js');
  const redis = redisModule.default as unknown as Redis;
  console.log('[BOOT] Redis client loaded');

  console.log('[BOOT] All modules loaded successfully');

  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  // Create HTTP server from Express app
  const server = createServer(app);
  console.log('[BOOT] HTTP server created');

  // Attach WebSocket server to the same HTTP server
  const wss = createWebSocketServer(server);
  console.log('[BOOT] WebSocket server attached');

  // Connect Redis
  console.log('[BOOT] Connecting to Redis...');
  await redis.connect().catch((err: Error) => {
    console.error('[BOOT] Redis connection failed:', err.message);
    console.warn(
      '[BOOT] Server will start without Redis — auth, rate limiting, and token blocklist will not work',
    );
  });

  // Validate DB connection with a lightweight query
  console.log('[BOOT] Testing database connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[BOOT] Database connection OK');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[BOOT] Database connection FAILED:', msg);
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] Cannot start in production without a working database. Exiting.');
      process.exit(1);
    }
    console.warn('[BOOT] Continuing in development mode with broken DB — queries will fail');
  }

  // Mark any stale active sessions as abandoned (from previous crash/restart)
  try {
    const { count } = await prisma.gameSession.updateMany({
      where: { status: 'active' },
      data: { status: 'abandoned', endedAt: new Date() },
    });
    if (count > 0) {
      console.log(`[DB] Marked ${count} stale active session(s) as abandoned`);
    }
  } catch (err) {
    console.warn('[DB] Could not clean stale sessions:', err);
  }

  // Graceful shutdown
  function shutdown(signal: string): void {
    console.log(`\n[${signal}] Shutting down Moltblox API server...`);

    wss.close(() => {
      console.log('[WS] WebSocket server closed');
    });

    server.close(async () => {
      console.log('[HTTP] HTTP server closed');
      redis.disconnect();
      console.log('[Redis] Disconnected');
      await prisma.$disconnect();
      console.log('[DB] Prisma disconnected');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start listening
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  =============================================');
    console.log('    Moltblox API Server');
    console.log('  =============================================');
    console.log(`  HTTP:      http://${HOST}:${PORT}`);
    console.log(`  WebSocket: ws://${HOST}:${PORT}`);
    console.log(`  Health:    http://${HOST}:${PORT}/health`);
    console.log(`  API:       http://${HOST}:${PORT}/api/v1`);
    console.log('  =============================================');
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  WS Clients:  ${wss.clients.size}`);
    console.log('');
  });
}

boot().catch((err) => {
  console.error('[FATAL] Server failed to start:', err);
  process.exit(1);
});
