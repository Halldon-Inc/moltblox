/**
 * Standardized error response utility for Moltblox API.
 *
 * Usage:
 *   sendError(res, 404, 'NotFound', 'Game not found');
 *   sendError(res, 403, 'Forbidden', 'You do not own this game');
 */

import type { Response } from 'express';

export function sendError(
  res: Response,
  statusCode: number,
  errorType: string,
  message: string,
): void {
  res.status(statusCode).json({ error: errorType, message });
}
