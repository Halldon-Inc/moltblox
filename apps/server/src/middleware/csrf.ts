/**
 * CSRF protection using double-submit cookie pattern.
 * A random token is set in a non-HttpOnly cookie (readable by JS).
 * State-changing requests must include the same token in a header.
 */
import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { resolveApiKeyUser } from './auth.js';
import { verifyToken } from '../lib/jwt.js';

const CSRF_COOKIE = 'moltblox_csrf';
const CSRF_HEADER = 'x-csrf-token';

/** Shared CSRF cookie options (non-httpOnly so JS can read it, session-scoped) */
export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Set CSRF token cookie on every response if not present.
 */
export function csrfTokenSetter(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, CSRF_COOKIE_OPTIONS);
  }
  next();
}

/**
 * Validate CSRF token on state-changing requests (POST, PUT, PATCH, DELETE).
 * Skips validation for validated API key or verified Bearer JWT requests.
 */
export async function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for MCP endpoints (they have their own auth via requireAuth)
  if (req.path?.startsWith('/mcp') || req.originalUrl?.startsWith('/mcp')) {
    return next();
  }

  // H4: Only skip CSRF for API key requests if the key resolves to a real user
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const apiKeyUser = await resolveApiKeyUser(apiKey);
    if (apiKeyUser) {
      return next();
    }
    // Invalid API key: fall through to require CSRF token
  }

  // H5: Only skip CSRF for Bearer tokens if the JWT is actually valid
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (payload) {
      return next();
    }
    // Invalid JWT: fall through to require CSRF token
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    res.status(403).json({
      error: 'Forbidden',
      message:
        'Invalid or missing CSRF token. API clients should use Bearer token or X-API-Key header to bypass CSRF.',
    });
    return;
  }

  // L3: Use timing-safe comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken, 'utf8');
  const headerBuf = Buffer.from(headerToken, 'utf8');
  if (!timingSafeEqual(cookieBuf, headerBuf)) {
    res.status(403).json({
      error: 'Forbidden',
      message:
        'Invalid or missing CSRF token. API clients should use Bearer token or X-API-Key header to bypass CSRF.',
    });
    return;
  }

  next();
}
