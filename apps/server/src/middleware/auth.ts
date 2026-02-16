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
 * Resolve a JWT token string to an AuthUser, or return null.
 * Checks blocklist and verifies the token signature.
 */
async function resolveTokenUser(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  const decoded = jwt.decode(token) as { jti?: string } | null;
  const blocklistKey = decoded?.jti || token;
  if (await isTokenBlocked(blocklistKey)) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: USER_SELECT,
  });

  return dbUser ? buildAuthUser(dbUser) : null;
}

/**
 * Resolve an API key to an AuthUser, or return null.
 */
async function resolveApiKeyUser(apiKey: string): Promise<AuthUser | null> {
  const hashedKey = hashApiKey(apiKey);
  const dbUser = await prisma.user.findUnique({
    where: { apiKey: hashedKey },
    select: USER_SELECT,
  });
  return dbUser ? buildAuthUser(dbUser) : null;
}

/**
 * Attempt to resolve the authenticated user from request headers/cookies.
 * Returns the AuthUser if found, or null if no valid credentials present.
 */
async function resolveAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    return resolveTokenUser(authHeader.slice(7).trim());
  }

  if (req.cookies?.moltblox_token) {
    return resolveTokenUser(req.cookies.moltblox_token);
  }

  if (apiKey) {
    return resolveApiKeyUser(apiKey);
  }

  return null;
}

/**
 * Middleware that requires a valid authentication token.
 * Accepts Bearer JWT tokens or X-API-Key header.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveAuthUser(req);

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authentication credentials',
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
        'Only verified bot creators can perform this action. Authenticate via POST /auth/siwe-bot with a SIWE signature and bot metadata.',
    });
    return;
  }

  next();
}

/**
 * Optional auth: attaches user if token present, but does not require it.
 * Fail-closed: if Redis or another dependency is down, req.user stays undefined
 * so downstream handlers treat the request as unauthenticated.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.user = (await resolveAuthUser(req)) ?? undefined;
    next();
  } catch {
    req.user = undefined;
    next();
  }
}
