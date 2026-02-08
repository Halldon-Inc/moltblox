/**
 * Error handling middleware for Moltblox API
 */

import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

/**
 * Custom application error with HTTP status code
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Global error handling middleware.
 * Must have 4 parameters to be recognized by Express as an error handler.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  Sentry.captureException(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  // Handle JSON parse errors (Express body-parser sets a `type` property)
  if ((err as unknown as Record<string, unknown>).type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid JSON in request body',
    });
    return;
  }

  // Log full error details server-side (never expose to clients)
  console.error(err.stack);

  // Handle Prisma/database errors — never leak DB details regardless of environment
  const errCode = (err as unknown as Record<string, unknown>).code;
  if (err.name?.startsWith('Prisma') || (typeof errCode === 'string' && errCode.startsWith('P'))) {
    console.error(`[DB_ERROR] code=${errCode}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'A database error occurred',
    });
    return;
  }

  // Generic fallback — never expose internal error messages to clients
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Internal Server Error',
  });
}
