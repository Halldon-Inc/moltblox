/**
 * Shared utility helpers for Moltblox API.
 */

import prisma from './prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Find a game by ID, verify it exists (404) and that the user owns it (403).
 * Returns the game record (with the selected fields) on success.
 * Throws AppError on failure so the global error handler responds.
 */
export async function requireGameOwnership<T extends Record<string, unknown>>(
  gameId: string,
  userId: string,
  select: Record<string, boolean> = { id: true, creatorId: true },
): Promise<T> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { ...select, creatorId: true },
  });

  if (!game) {
    throw new AppError('Game not found', 404);
  }

  if (game.creatorId !== userId) {
    throw new AppError('You do not own this game', 403);
  }

  return game as unknown as T;
}

/**
 * Generate a URL-friendly slug from a name string.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a map of { date: defaultValue } for the last N days.
 * Useful for daily time-series with zero-filled defaults.
 */
export function buildDailyTimeSeries<T>(days: number, defaultValue: T): Record<string, T> {
  const result: Record<string, T> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result[d.toISOString().slice(0, 10)] = defaultValue;
  }
  return result;
}
