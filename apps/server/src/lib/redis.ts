/**
 * Redis client for Moltblox API
 * Used for nonce storage, session caching, and rate limiting.
 */
import { Redis } from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

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

/**
 * Create a RedisStore for express-rate-limit backed by this Redis client.
 */
export function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never>,
    prefix: `rl:${prefix}:`,
  });
}

export default redis;
