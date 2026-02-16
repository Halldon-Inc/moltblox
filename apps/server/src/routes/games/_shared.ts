/**
 * Shared utilities for game sub-routers
 */

import rateLimit from 'express-rate-limit';
import { createRedisStore } from '../../lib/redis.js';
import { serializeBigIntFields } from '../../lib/serialize.js';
import { slugify as slugifyUtil } from '../../lib/utils.js';

// Games-specific write limiter (60s window, 30 max), Redis-backed
export const gamesWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('games-write'),
  message: { error: 'TooManyRequests', message: 'Write rate limit exceeded.' },
});

export const slugify = slugifyUtil;

/**
 * Serialize BigInt fields on a game record.
 */
export function serializeGame(game: Record<string, unknown>) {
  return serializeBigIntFields(game, ['totalRevenue']);
}
