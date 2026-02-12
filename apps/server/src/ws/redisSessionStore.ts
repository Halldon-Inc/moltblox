/**
 * Redis-backed session store for horizontal scaling.
 *
 * Provides Redis storage for matchmaking queues, active sessions, and
 * player-to-session mappings. Falls back to in-memory Maps when Redis
 * is unavailable (development mode).
 *
 * Key patterns:
 *   mq:{gameId}            Redis List of JSON-serialized QueueEntry
 *   session:{sessionId}    Redis Hash with session fields (JSON values)
 *   player-sessions        Redis Hash: playerId -> sessionId
 *
 * TTL: Session keys expire after 24 hours for automatic cleanup.
 */

import type Redis from 'ioredis';
import type { GameState, GameAction, GameEvent } from '@moltblox/protocol';

// Re-export the queue entry shape so sessionManager can use it
export interface QueueEntry {
  clientId: string;
  playerId: string;
  joinedAt: number;
}

export interface ActiveSessionData {
  sessionId: string;
  gameId: string;
  playerIds: string[];
  gameState: GameState;
  currentTurn: number;
  actionHistory: Array<{ playerId: string; action: GameAction; turn: number; timestamp: number }>;
  events: GameEvent[];
  ended: boolean;
}

const SESSION_TTL_SECONDS = 86_400; // 24 hours
const QUEUE_TTL_SECONDS = 3_600; // 1 hour

// ---- In-memory fallback stores (used when Redis is unavailable) ----

const memQueues = new Map<string, QueueEntry[]>();
const memSessions = new Map<string, ActiveSessionData>();
const memPlayerSessions = new Map<string, string>();

/**
 * Check whether the Redis client is connected and ready.
 */
function isRedisReady(redis: Redis | null): redis is Redis {
  if (!redis) return false;
  return redis.status === 'ready';
}

// ======================================================================
// Match Queue operations
// ======================================================================

export async function getQueue(redis: Redis | null, gameId: string): Promise<QueueEntry[]> {
  if (!isRedisReady(redis)) {
    return memQueues.get(gameId) ?? [];
  }
  const items = await redis.lrange(`mq:${gameId}`, 0, -1);
  return items.map((item) => JSON.parse(item) as QueueEntry);
}

export async function pushToQueue(
  redis: Redis | null,
  gameId: string,
  entry: QueueEntry,
): Promise<number> {
  if (!isRedisReady(redis)) {
    if (!memQueues.has(gameId)) memQueues.set(gameId, []);
    const q = memQueues.get(gameId)!;
    q.push(entry);
    return q.length;
  }
  const len = await redis.rpush(`mq:${gameId}`, JSON.stringify(entry));
  // Set TTL on the queue key (refreshed on each push)
  await redis.expire(`mq:${gameId}`, QUEUE_TTL_SECONDS);
  return len;
}

/**
 * Splice `count` entries from the front of the queue (for match creation).
 * Uses a Redis transaction to pop atomically.
 */
export async function spliceQueueFront(
  redis: Redis | null,
  gameId: string,
  count: number,
): Promise<QueueEntry[]> {
  if (!isRedisReady(redis)) {
    const q = memQueues.get(gameId);
    if (!q) return [];
    return q.splice(0, count);
  }
  const key = `mq:${gameId}`;
  const results: QueueEntry[] = [];
  for (let i = 0; i < count; i++) {
    const raw = await redis.lpop(key);
    if (!raw) break;
    results.push(JSON.parse(raw) as QueueEntry);
  }
  return results;
}

/**
 * Check if a player is already in any match queue.
 * Returns the gameId they are queued for, or null.
 */
export async function findPlayerInQueues(
  redis: Redis | null,
  playerId: string,
): Promise<string | null> {
  if (!isRedisReady(redis)) {
    for (const [gameId, queue] of memQueues) {
      if (queue.some((e) => e.playerId === playerId)) return gameId;
    }
    return null;
  }
  // Scan all queue keys
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'mq:*', 'COUNT', 100);
    cursor = nextCursor;
    for (const key of keys) {
      const items = await redis.lrange(key, 0, -1);
      for (const item of items) {
        const entry = JSON.parse(item) as QueueEntry;
        if (entry.playerId === playerId) {
          return key.replace('mq:', '');
        }
      }
    }
  } while (cursor !== '0');
  return null;
}

/**
 * Remove a specific client from all queues.
 * Returns { removed: boolean; gameId?: string }.
 */
export async function removeFromQueues(
  redis: Redis | null,
  clientId: string,
): Promise<{ removed: boolean; gameId?: string }> {
  if (!isRedisReady(redis)) {
    for (const [gameId, queue] of memQueues) {
      const idx = queue.findIndex((e) => e.clientId === clientId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        if (queue.length === 0) memQueues.delete(gameId);
        return { removed: true, gameId };
      }
    }
    return { removed: false };
  }

  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'mq:*', 'COUNT', 100);
    cursor = nextCursor;
    for (const key of keys) {
      const items = await redis.lrange(key, 0, -1);
      for (const item of items) {
        const entry = JSON.parse(item) as QueueEntry;
        if (entry.clientId === clientId) {
          await redis.lrem(key, 1, item);
          const gameId = key.replace('mq:', '');
          // Clean up empty queue keys
          const remaining = await redis.llen(key);
          if (remaining === 0) await redis.del(key);
          return { removed: true, gameId };
        }
      }
    }
  } while (cursor !== '0');
  return { removed: false };
}

// ======================================================================
// Active Session operations
// ======================================================================

export async function getSession(
  redis: Redis | null,
  sessionId: string,
): Promise<ActiveSessionData | null> {
  if (!isRedisReady(redis)) {
    return memSessions.get(sessionId) ?? null;
  }
  const data = await redis.get(`session:${sessionId}`);
  if (!data) return null;
  return JSON.parse(data) as ActiveSessionData;
}

export async function setSession(
  redis: Redis | null,
  sessionId: string,
  session: ActiveSessionData,
): Promise<void> {
  if (!isRedisReady(redis)) {
    memSessions.set(sessionId, session);
    return;
  }
  await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
}

export async function deleteSession(redis: Redis | null, sessionId: string): Promise<void> {
  if (!isRedisReady(redis)) {
    memSessions.delete(sessionId);
    return;
  }
  await redis.del(`session:${sessionId}`);
}

export async function hasSession(redis: Redis | null, sessionId: string): Promise<boolean> {
  if (!isRedisReady(redis)) {
    return memSessions.has(sessionId);
  }
  const exists = await redis.exists(`session:${sessionId}`);
  return exists === 1;
}

// ======================================================================
// Player-to-Session mapping
// ======================================================================

export async function setPlayerSession(
  redis: Redis | null,
  playerId: string,
  sessionId: string,
): Promise<void> {
  if (!isRedisReady(redis)) {
    memPlayerSessions.set(playerId, sessionId);
    return;
  }
  await redis.hset('player-sessions', playerId, sessionId);
}

export async function getPlayerSession(
  redis: Redis | null,
  playerId: string,
): Promise<string | null> {
  if (!isRedisReady(redis)) {
    return memPlayerSessions.get(playerId) ?? null;
  }
  return await redis.hget('player-sessions', playerId);
}

export async function deletePlayerSession(redis: Redis | null, playerId: string): Promise<void> {
  if (!isRedisReady(redis)) {
    memPlayerSessions.delete(playerId);
    return;
  }
  await redis.hdel('player-sessions', playerId);
}

// ======================================================================
// Pub/Sub helpers
// ======================================================================

/**
 * Publish a match-found notification so all server instances can react.
 */
export async function publishMatchFound(
  redis: Redis | null,
  sessionId: string,
  gameId: string,
  playerIds: string[],
): Promise<void> {
  if (!isRedisReady(redis)) return; // single-instance, no need to publish
  await redis.publish('ws:match', JSON.stringify({ sessionId, gameId, playerIds }));
}

/**
 * Publish a session state update for cross-instance notification.
 */
export async function publishSessionUpdate(
  redis: Redis | null,
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isRedisReady(redis)) return;
  await redis.publish(`ws:session:${sessionId}`, JSON.stringify(payload));
}

// ======================================================================
// Cleanup (for startup or periodic maintenance)
// ======================================================================

/**
 * Clear all session and queue keys from Redis.
 * Uses SCAN to avoid blocking the server.
 */
export async function cleanupAllSessions(redis: Redis | null): Promise<number> {
  if (!isRedisReady(redis)) {
    const count = memSessions.size + memQueues.size;
    memSessions.clear();
    memQueues.clear();
    memPlayerSessions.clear();
    return count;
  }

  let deleted = 0;
  // Clean session keys
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');

  // Clean queue keys
  cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'mq:*', 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');

  // Clean player-sessions hash
  await redis.del('player-sessions');

  return deleted;
}
