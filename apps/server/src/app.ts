/**
 * Express application setup for Moltblox API
 */

console.log('[BOOT] Loading Express app...');

import { initSentry, Sentry } from './lib/sentry.js';
initSentry();
console.log('[BOOT] Sentry initialized');

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import redis from './lib/redis.js';
import { createRedisStore } from './lib/redis.js';
import { allowedOrigins } from './lib/config.js';

import prisma from './lib/prisma.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games/index.js';
import tournamentsRouter from './routes/tournaments.js';
import marketplaceRouter from './routes/marketplace.js';
import socialRouter from './routes/social.js';
import walletRouter from './routes/wallet.js';
import statsRouter from './routes/stats.js';
import usersRouter from './routes/users.js';
import analyticsRouter from './routes/analytics.js';
import collaboratorRoutes from './routes/collaborators.js';
import playRouter from './routes/play.js';
import leaderboardsRouter from './routes/leaderboards.js';
import notificationsRouter from './routes/notifications.js';
import badgesRouter from './routes/badges.js';
import wagersRouter from './routes/wagers.js';
import itemsRouter from './routes/items.js';
import rewardsRouter from './routes/rewards.js';
import uploadsRouter from './routes/uploads.js';
import mcpRouter from './routes/mcp.js';
import skillRouter from './routes/skill.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfTokenSetter, csrfProtection } from './middleware/csrf.js';

const app: Express = express();

// ---------------------
// Security & Parsing
// ---------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  }),
);

app.use(cookieParser());

app.use(csrfTokenSetter);

// ---------------------
// Rate Limiting
// ---------------------

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('global'),
  message: { error: 'TooManyRequests', message: 'Rate limit exceeded. Try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('auth'),
  message: { error: 'TooManyRequests', message: 'Too many auth attempts. Try again later.' },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('write'),
  message: { error: 'TooManyRequests', message: 'Write rate limit exceeded. Try again later.' },
});

app.use(globalLimiter);
console.log('[BOOT] Rate limiters configured');

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-CSRF-Token',
      'mcp-session-id',
    ],
    exposedHeaders: ['mcp-session-id'],
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

// CSRF protection for state-changing requests
app.use(csrfProtection);

// ---------------------
// Request Logging
// ---------------------

app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ---------------------
// Health Check
// ---------------------

app.get('/health', async (_req: Request, res: Response) => {
  let dbOk = false;
  let redisOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB unreachable
  }

  try {
    if (redis.status === 'ready') {
      await redis.ping();
      redisOk = true;
    }
  } catch {
    // Redis unreachable
  }

  const healthy = dbOk && redisOk;
  const statusCode = healthy ? 200 : 503;

  res.status(statusCode).json({ status: healthy ? 'ok' : 'degraded' });
});

// ---------------------
// API v1 Routes
// ---------------------

app.use('/api/v1/auth', authLimiter, authRouter);
// playRouter and collaboratorRoutes mounted before gamesRouter so static
// paths (/play-info, /active-sessions, /collaborators) match before /:id
app.use('/api/v1/games', playRouter);
app.use('/api/v1/games', collaboratorRoutes);
app.use('/api/v1/games', gamesRouter);
const writeOnly =
  (limiter: ReturnType<typeof rateLimit>) => (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return limiter(req, res, next);
    next();
  };
app.use('/api/v1/tournaments', writeOnly(writeLimiter), tournamentsRouter);
app.use('/api/v1/marketplace', writeOnly(writeLimiter), marketplaceRouter);
app.use('/api/v1/social', writeOnly(writeLimiter), socialRouter);
app.use('/api/v1/wallet', writeOnly(writeLimiter), walletRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/creator/analytics', analyticsRouter);
app.use('/api/v1/creator/dashboard', analyticsRouter);
app.use('/api/v1/badges', badgesRouter);
app.use('/api/v1/leaderboards', leaderboardsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/wagers', writeOnly(writeLimiter), wagersRouter);
app.use('/api/v1/items', writeOnly(writeLimiter), itemsRouter);
app.use('/api/v1/rewards', writeOnly(writeLimiter), rewardsRouter);
app.use('/api/v1/uploads', writeOnly(writeLimiter), uploadsRouter);

// Alias: /api/v1/submolts/* -> /api/v1/social/submolts/*
app.use('/api/v1/submolts', (req: Request, _res: Response, next: NextFunction) => {
  req.url = '/submolts' + req.url;
  socialRouter(req, _res, next);
});
// ---------------------
// Skill Documentation
// ---------------------

app.use('/api/skill', skillRouter);
app.use('/api/v1/skill', skillRouter);

// ---------------------
// MCP Server (Remote)
// ---------------------

app.use('/mcp', mcpRouter);

console.log('[BOOT] All API routes mounted');

// ---------------------
// 404 Handler
// ---------------------

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    hint: 'Available prefixes: /api/v1/auth, /api/v1/games, /api/v1/tournaments, /api/v1/marketplace, /api/v1/items, /api/v1/social, /api/v1/wallet, /api/v1/badges, /api/v1/rewards, /api/v1/uploads, /api/v1/users, /api/v1/stats, /api/v1/wagers, /api/skill, /mcp. Play API: GET /api/v1/games/play-info',
  });
});

// ---------------------
// Error Handler
// ---------------------

// Sentry error handler (must be before custom error handler)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

export default app;
