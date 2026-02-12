/**
 * JWT token blocklist backed by Redis.
 * Blocked tokens expire after 7 days (matching JWT TTL).
 *
 * Fail-closed: when Redis is unavailable in production, isTokenBlocked
 * returns true (blocked) so that a Redis outage cannot be exploited to
 * bypass token revocation.
 */
import redis from './redis.js';

const KEY_PREFIX = 'blocklist:';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function blockToken(jti: string): Promise<void> {
  await redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', TTL_SECONDS);
}

export async function isTokenBlocked(jti: string): Promise<boolean> {
  try {
    const result = await redis.exists(`${KEY_PREFIX}${jti}`);
    return result === 1;
  } catch {
    // Fail-closed: treat Redis failure as "blocked" in production
    // so a Redis outage cannot bypass token revocation
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[tokenBlocklist] Redis unavailable, failing closed (token treated as blocked)',
      );
      return true;
    }
    return false;
  }
}
