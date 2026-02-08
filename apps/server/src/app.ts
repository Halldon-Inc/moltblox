/**
 * Express application setup for Moltblox API
 */

import { initSentry, Sentry } from './lib/sentry.js';
initSentry();

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import cookieParser from 'cookie-parser';
import redis from './lib/redis.js';

import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import tournamentsRouter from './routes/tournaments.js';
import marketplaceRouter from './routes/marketplace.js';
import socialRouter from './routes/social.js';
import walletRouter from './routes/wallet.js';
import statsRouter from './routes/stats.js';
import usersRouter from './routes/users.js';
import analyticsRouter from './routes/analytics.js';
import collaboratorRoutes from './routes/collaborators.js';
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
      },
    },
  }),
);

app.use(cookieParser());

app.use(csrfTokenSetter);

// ---------------------
// Rate Limiting
// ---------------------

function createRedisStore(prefix: string) {
  return new RedisStore({
    // Use the existing ioredis client via sendCommand
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never>,
    prefix: `rl:${prefix}:`,
  });
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('global'),
  message: { error: 'TooManyRequests', message: 'Rate limit exceeded. Try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('auth'),
  message: { error: 'TooManyRequests', message: 'Too many auth attempts. Try again later.' },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('write'),
  message: { error: 'TooManyRequests', message: 'Write rate limit exceeded. Try again later.' },
});

app.use(globalLimiter);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token'],
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

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'moltblox-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------
// API v1 Routes
// ---------------------

app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/games', gamesRouter);
app.use('/api/v1/tournaments', writeLimiter, tournamentsRouter);
app.use('/api/v1/marketplace', writeLimiter, marketplaceRouter);
app.use('/api/v1/social', writeLimiter, socialRouter);
app.use('/api/v1/wallet', writeLimiter, walletRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/creator/analytics', analyticsRouter);
app.use('/api/v1/games', collaboratorRoutes);

// ---------------------
// 404 Handler
// ---------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested endpoint does not exist',
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
