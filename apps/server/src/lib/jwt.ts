/**
 * Shared JWT utilities for Moltblox API
 *
 * Centralizes JWT_SECRET, token signing, verification, and blocklist key extraction
 * so that middleware/auth.ts and ws/index.ts use the same secret and logic.
 */

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

export const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    console.warn('[SECURITY] Using default JWT secret — set JWT_SECRET env var for production');
    return 'moltblox-dev-secret-DO-NOT-USE-IN-PRODUCTION';
  })();

const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Verify a JWT token and return its payload.
 */
export function verifyToken(token: string): { userId: string; address: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      address: string;
      iat: number;
      exp: number;
    };
    return { userId: payload.userId, address: payload.address };
  } catch {
    return null;
  }
}

/**
 * Sign a JWT token for a user. Includes a unique `jti` for blocklist support.
 */
export function signToken(userId: string, address: string): string {
  return jwt.sign(
    { userId, address, jti: randomUUID() },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRY } as jwt.SignOptions,
  );
}

/**
 * Extract the jti (or fallback to raw token) for blocklist operations.
 */
export function extractBlocklistKey(token: string): string {
  const decoded = jwt.decode(token) as { jti?: string } | null;
  return decoded?.jti || token;
}
