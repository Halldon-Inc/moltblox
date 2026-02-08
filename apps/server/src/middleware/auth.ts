/**
 * Authentication middleware for Moltblox API
 * Supports JWT tokens (from SIWE), API keys, and Moltbook identity tokens
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { isTokenBlocked } from '../lib/tokenBlocklist.js';
import { hashApiKey } from '../lib/crypto.js';
import { verifyToken, signToken, extractBlocklistKey } from '../lib/jwt.js';

// Re-export for consumers that import from middleware/auth
export { signToken, extractBlocklistKey };

export type UserRole = 'human' | 'bot';

export interface AuthUser {
  id: string;
  address: string;
  displayName: string;
  role: UserRole;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

const USER_SELECT = {
  id: true,
  walletAddress: true,
  displayName: true,
  username: true,
  role: true,
} as const;

const VALID_ROLES: readonly UserRole[] = ['human', 'bot'] as const;

function buildAuthUser(dbUser: {
  id: string;
  walletAddress: string;
  displayName: string | null;
  username: string | null;
  role: string;
}): AuthUser {
  if (!VALID_ROLES.includes(dbUser.role as UserRole)) {
    throw new Error(`Invalid user role: ${dbUser.role}`);
  }
  return {
    id: dbUser.id,
    address: dbUser.walletAddress,
    displayName: dbUser.displayName || dbUser.username || dbUser.walletAddress.slice(0, 10),
    role: dbUser.role as UserRole,
  };
}

/**
 * Middleware that requires a valid authentication token.
 * Accepts Bearer JWT tokens or X-API-Key header.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    let user: AuthUser | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (!token) {
        res.status(401).json({ error: 'Unauthorized', message: 'Empty token' });
        return;
      }

      // Check if token has been blocklisted (logged out)
      const decoded = jwt.decode(token) as { jti?: string } | null;
      const blocklistKey = decoded?.jti || token;
      if (await isTokenBlocked(blocklistKey)) {
        res.status(401).json({ error: 'Unauthorized', message: 'Token has been revoked' });
        return;
      }

      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: USER_SELECT,
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        return;
      }

      user = buildAuthUser(dbUser);
    } else if (req.cookies?.moltblox_token) {
      const cookieToken = req.cookies.moltblox_token;

      // Check if token has been blocklisted (logged out)
      const decoded = jwt.decode(cookieToken) as { jti?: string } | null;
      const blocklistKey = decoded?.jti || cookieToken;
      if (await isTokenBlocked(blocklistKey)) {
        res.status(401).json({ error: 'Unauthorized', message: 'Token has been revoked' });
        return;
      }

      const payload = verifyToken(cookieToken);
      if (!payload) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: USER_SELECT,
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        return;
      }

      user = buildAuthUser(dbUser);
    } else if (apiKey) {
      const hashedKey = hashApiKey(apiKey);
      const dbUser = await prisma.user.findUnique({
        where: { apiKey: hashedKey },
        select: USER_SELECT,
      });

      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
        return;
      }

      user = buildAuthUser(dbUser);
    }

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header (Bearer token) or X-API-Key header',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware that requires the authenticated user to be a bot (Moltbook-verified agent).
 * Must be used AFTER requireAuth.
 */
export async function requireBot(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'bot') {
    res.status(403).json({
      error: 'Forbidden',
      message:
        'Only verified bot creators can perform this action. Authenticate via Moltbook identity to create games.',
    });
    return;
  }

  next();
}

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();

      // Check blocklist — revoked tokens must not populate req.user
      const decoded = jwt.decode(token) as { jti?: string } | null;
      const blocklistKey = decoded?.jti || token;
      if (!(await isTokenBlocked(blocklistKey))) {
        const payload = verifyToken(token);
        if (payload) {
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: USER_SELECT,
          });
          if (dbUser) {
            req.user = buildAuthUser(dbUser);
          }
        }
      }
    } else if (req.cookies?.moltblox_token) {
      const cookieToken = req.cookies.moltblox_token;

      // Check blocklist — revoked tokens must not populate req.user
      const decoded = jwt.decode(cookieToken) as { jti?: string } | null;
      const blocklistKey = decoded?.jti || cookieToken;
      if (!(await isTokenBlocked(blocklistKey))) {
        const payload = verifyToken(cookieToken);
        if (payload) {
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: USER_SELECT,
          });
          if (dbUser) {
            req.user = buildAuthUser(dbUser);
          }
        }
      }
    } else if (apiKey) {
      const hashedKey = hashApiKey(apiKey);
      const dbUser = await prisma.user.findUnique({
        where: { apiKey: hashedKey },
        select: USER_SELECT,
      });
      if (dbUser) {
        req.user = buildAuthUser(dbUser);
      }
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
}
