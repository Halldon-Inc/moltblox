/**
 * CSRF protection using double-submit cookie pattern.
 * A random token is set in a non-HttpOnly cookie (readable by JS).
 * State-changing requests must include the same token in a header.
 */
import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'moltblox_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Set CSRF token cookie on every response if not present.
 */
export function csrfTokenSetter(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Must be readable by frontend JS
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
  next();
}

/**
 * Validate CSRF token on state-changing requests (POST, PUT, PATCH, DELETE).
 * Skips validation for API key authenticated requests (bots).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for API key authenticated requests (bots/agents)
  if (req.headers['x-api-key']) {
    return next();
  }

  // Skip for Bearer token authenticated requests (API/bot clients don't use cookies)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token',
    });
    return;
  }

  // L3: Use timing-safe comparison to prevent timing attacks
  const cookieBuf = Buffer.from(cookieToken, 'utf8');
  const headerBuf = Buffer.from(headerToken, 'utf8');
  if (!timingSafeEqual(cookieBuf, headerBuf)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token',
    });
    return;
  }

  next();
}
