/**
 * Authentication middleware for Moltblox API
 * Currently uses mock auth - accepts any non-empty Bearer token
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: string;
  address: string;
  displayName: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware that requires a valid authentication token.
 * For now, accepts any non-empty Bearer token and attaches a mock user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Empty token provided',
    });
    return;
  }

  // Mock user - in production this would verify JWT and look up the user
  req.user = {
    id: 'mock-user-001',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    displayName: 'MockPlayer',
  };

  next();
}
