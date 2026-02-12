/**
 * Redis client for Moltblox API
 * Used for nonce storage, session caching, and rate limiting.
 */
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`[BOOT] Creating Redis client (host: ${REDIS_URL.replace(/\/\/.*@/, '//***@')})`);

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 3) {
      console.error('[Redis] Max retries reached, giving up');
      return null;
    }
    const delay = Math.min(times * 200, 2000);
    console.warn(`[Redis] Retry ${times}/3 in ${delay}ms`);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('ready', () => console.log('[Redis] Ready'));
redis.on('close', () => console.warn('[Redis] Connection closed'));
redis.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
redis.on('error', (err: Error) => console.error('[Redis] Error:', err.message));

export default redis;
