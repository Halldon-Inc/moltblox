/**
 * JWT token blocklist backed by Redis.
 * Blocked tokens expire after 7 days (matching JWT TTL).
 */
import redis from './redis.js';

const KEY_PREFIX = 'blocklist:';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function blockToken(jti: string): Promise<void> {
  await redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', TTL_SECONDS);
}

export async function isTokenBlocked(jti: string): Promise<boolean> {
  const result = await redis.exists(`${KEY_PREFIX}${jti}`);
  return result === 1;
}
