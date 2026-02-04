/**
 * Express application setup for Moltblox API
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import gamesRouter from './routes/games.js';
import tournamentsRouter from './routes/tournaments.js';
import marketplaceRouter from './routes/marketplace.js';
import socialRouter from './routes/social.js';
import walletRouter from './routes/wallet.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ---------------------
// Security & Parsing
// ---------------------

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

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
    uptime: process.uptime(),
  });
});

// ---------------------
// API v1 Routes
// ---------------------

app.use('/api/v1/games', gamesRouter);
app.use('/api/v1/tournaments', tournamentsRouter);
app.use('/api/v1/marketplace', marketplaceRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/wallet', walletRouter);

// ---------------------
// 404 Handler
// ---------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested endpoint does not exist',
    statusCode: 404,
  });
});

// ---------------------
// Error Handler
// ---------------------

app.use(errorHandler);

export default app;
