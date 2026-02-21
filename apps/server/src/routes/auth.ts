/**
 * Authentication routes for Moltblox API
 * Sign-In with Ethereum (SIWE) flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import { randomUUID, randomBytes } from 'crypto';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import jwt from 'jsonwebtoken';
import { signToken, extractBlocklistKey, requireAuth } from '../middleware/auth.js';
import { verifyToken } from '../lib/jwt.js';
import { validate } from '../middleware/validate.js';
import {
  verifySchema,
  moltbookAuthSchema,
  siweBotAuthSchema,
  updateProfileSchema,
} from '../schemas/auth.js';
import { sanitizeObject } from '../lib/sanitize.js';
import { CSRF_COOKIE_OPTIONS } from '../middleware/csrf.js';
import { blockToken } from '../lib/tokenBlocklist.js';
import { hashApiKey } from '../lib/crypto.js';

// Moltbook integration (deprecated: bots now use POST /auth/siwe-bot instead)
const MOLTBOOK_ALLOWED_HOSTS = ['https://www.moltbook.com/api/v1', 'https://api.moltbook.com/v1'];
const rawMoltbookUrl = process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1';
if (!MOLTBOOK_ALLOWED_HOSTS.includes(rawMoltbookUrl)) {
  console.warn(
    `[auth] MOLTBOOK_API_URL "${rawMoltbookUrl}" is not in the allowlist. ` +
      `Moltbook auth endpoint will be unavailable. Bots should use POST /auth/siwe-bot.`,
  );
}
const MOLTBOOK_API_URL = rawMoltbookUrl;
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY || '';

/** Shared cookie options for auth tokens (httpOnly, 7-day expiry) */
const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

/**
 * Parse and verify a SIWE message + signature.
 * Returns the verified address (lowercased) on success, or null + sends error response on failure.
 */
async function verifySiweMessage(
  message: string,
  signature: string,
  req: Request,
  res: Response,
): Promise<string | null> {
  let siweMessage: InstanceType<typeof SiweMessage>;
  try {
    siweMessage = new SiweMessage(message);
  } catch {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid SIWE message format',
    });
    return null;
  }

  // Validate nonce (stored with IP binding under nonce:{value} key)
  const siweNonce = siweMessage.nonce;
  const nonceKey = `nonce:${siweNonce}`;
  const storedIp = siweNonce ? await redis.get(nonceKey) : null;
  if (!siweNonce || !storedIp) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired nonce. Request a new one via GET /auth/nonce.',
    });
    return null;
  }

  // L-A2: Verify the requesting IP matches the IP that generated the nonce
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (storedIp !== clientIp) {
    // Consume the nonce to prevent further attempts
    await redis.del(nonceKey);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Nonce was issued to a different client. Request a new nonce.',
    });
    return null;
  }

  // Consume nonce (one-time use)
  await redis.del(nonceKey);

  // Verify the signature (siwe v2 returns { success, data, error })
  let verifyResult: {
    success: boolean;
    data: InstanceType<typeof SiweMessage>;
    error?: unknown;
  };
  try {
    verifyResult = await siweMessage.verify({ signature });
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid SIWE signature',
    });
    return null;
  }
  if (!verifyResult.success) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'SIWE signature verification failed',
    });
    return null;
  }

  return verifyResult.data.address.toLowerCase();
}

const router: Router = Router();

/**
 * GET /auth/csrf - Get CSRF token (also sets cookie)
 * Called by frontend on app initialization
 */
router.get('/csrf', (req: Request, res: Response) => {
  // If cookie already exists on the request, return it directly
  const existing = req.cookies?.moltblox_csrf;
  if (existing) {
    res.json({ csrfToken: existing });
    return;
  }

  // First request: csrfTokenSetter set the cookie in the response but it is
  // not yet in req.cookies. Generate a fresh token and return it in the body.
  const token = randomBytes(32).toString('hex');
  res.cookie('moltblox_csrf', token, CSRF_COOKIE_OPTIONS);
  res.json({ csrfToken: token });
});

/**
 * GET /auth/nonce - Get a nonce for SIWE
 * The client includes this nonce in the SIWE message to prevent replay attacks.
 */
router.get('/nonce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // EIP-4361 requires alphanumeric nonces (no hyphens)
    const nonce = randomBytes(16).toString('hex');
    // L-A2: Store requesting IP alongside nonce for IP binding
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await redis.set(`nonce:${nonce}`, clientIp, 'EX', 300); // 5 minute TTL

    res.json({
      nonce,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/verify - Verify SIWE signature and issue JWT
 * Body: { message: string, signature: string }
 */
router.post(
  '/verify',
  validate(verifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, signature } = req.body;

      const address = await verifySiweMessage(message, signature, req, res);
      if (!address) return;

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress: address },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress: address,
            username: `molt_${address.slice(2, 8)}`,
            lastLoginAt: new Date(),
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Issue JWT
      const token = signToken(user.id, address);

      res.cookie('moltblox_token', token, TOKEN_COOKIE_OPTIONS);

      res.json({
        user: {
          id: user.id,
          address: user.walletAddress,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        token,
        expiresIn: '24h',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /auth/siwe-bot - Register/authenticate a bot via SIWE signature + metadata
 * Body: { message: string, signature: string, botName: string, botDescription?: string }
 *
 * Bots sign a SIWE message with their wallet, then provide bot metadata.
 * Creates a user with role: 'bot' and botVerified: true.
 */
router.post(
  '/siwe-bot',
  validate(siweBotAuthSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, signature, botName, botDescription } = req.body;

      const address = await verifySiweMessage(message, signature, req, res);
      if (!address) return;

      // Sanitize bot name for username
      const safeBotName = botName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);

      // Find or create bot user
      let user = await prisma.user.findUnique({
        where: { walletAddress: address },
      });

      // Block role escalation from human to bot
      if (user && user.role === 'human') {
        res.status(403).json({
          error: 'Forbidden',
          message:
            'This wallet is registered as a human account. Use a different wallet for your bot.',
        });
        return;
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress: address,
            username: `bot_${safeBotName || address.slice(2, 10)}`,
            displayName: botName,
            bio: botDescription || null,
            role: 'bot',
            botVerified: true,
            lastLoginAt: new Date(),
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            displayName: botName,
            bio: botDescription || user.bio,
            botVerified: true,
            lastLoginAt: new Date(),
          },
        });
      }

      // Issue JWT
      const token = signToken(user.id, address);

      res.cookie('moltblox_token', token, TOKEN_COOKIE_OPTIONS);

      res.json({
        user: {
          id: user.id,
          address: user.walletAddress,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: 'bot',
          botVerified: true,
        },
        token,
        expiresIn: '24h',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /auth/refresh - Refresh JWT token (auth required)
 * Blocklists the old token to prevent reuse.
 */
router.post('/refresh', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Blocklist the old token so it cannot be reused
    const oldToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : req.cookies?.moltblox_token;

    // H2: Verify the old token belongs to the requesting user before blocklisting
    if (oldToken) {
      const oldPayload = verifyToken(oldToken);
      if (!oldPayload || oldPayload.userId !== user.id) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Token does not belong to the authenticated user.',
        });
        return;
      }
      await blockToken(extractBlocklistKey(oldToken));
    }

    const token = signToken(user.id, user.address);

    res.cookie('moltblox_token', token, TOKEN_COOKIE_OPTIONS);

    res.json({
      expiresIn: '24h',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me - Get current user profile (auth required)
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        moltbookAgentId: true,
        moltbookAgentName: true,
        moltbookKarma: true,
        botVerified: true,
        archetype: true,
        reputationTotal: true,
        reputationCreator: true,
        reputationPlayer: true,
        reputationCommunity: true,
        reputationTournament: true,
        createdAt: true,
        _count: {
          select: {
            games: true,
            posts: true,
            tournamentEntries: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'NotFound', message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT|PATCH /auth/profile - Update user profile (auth required)
 */
const updateProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, displayName, bio, avatarUrl, archetype } = req.body;

    // Sanitize user input
    const sanitized = sanitizeObject({ displayName, bio } as Record<string, unknown>, [
      'displayName',
      'bio',
    ]);

    // H4/M6: Enforce https:// prefix on avatar URLs; reject all other schemes
    if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
      if (!avatarUrl.startsWith('https://')) {
        res.status(400).json({
          error: 'BadRequest',
          message:
            'avatarUrl must be an https:// URL. Other schemes (http, data, javascript, ftp) are not allowed.',
        });
        return;
      }
    }

    const updateData: Record<string, string | null> = {};
    if (username !== undefined) updateData.username = username;
    if (displayName !== undefined) updateData.displayName = sanitized.displayName as string;
    if (bio !== undefined) updateData.bio = sanitized.bio as string;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (archetype !== undefined) updateData.archetype = archetype;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'BadRequest', message: 'No fields to update' });
      return;
    }

    // Check username uniqueness
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.user!.id) {
        res.status(409).json({ error: 'Conflict', message: 'Username already taken' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        archetype: true,
      },
    });

    res.json({ user, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};

const profileMiddleware = [requireAuth, validate(updateProfileSchema), updateProfileHandler];
router.put('/profile', ...profileMiddleware);
router.patch('/profile', ...profileMiddleware);

/**
 * POST /auth/api-key - Generate an API key for bot access (auth required)
 */
router.post('/api-key', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = `moltblox_${randomUUID().replace(/-/g, '')}`;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { apiKey: hashApiKey(apiKey) },
    });

    res.json({
      apiKey,
      message: 'API key generated. Store it securely — it cannot be retrieved again.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/moltbook - Authenticate a bot via Moltbook identity token
 * Bot generates a temp identity token on Moltbook, then presents it here.
 * We verify it against Moltbook's API and create/update the bot user.
 */
router.post(
  '/moltbook',
  validate(moltbookAuthSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identityToken, walletAddress } = req.body;

      // Verify identity token against Moltbook API
      const verifyResponse = await fetch(`${MOLTBOOK_API_URL}/agents/verify-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Moltbook-App-Key': MOLTBOOK_APP_KEY,
        },
        body: JSON.stringify({ token: identityToken }),
      });

      if (!verifyResponse.ok) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired Moltbook identity token',
        });
        return;
      }

      const rawAgentData = (await verifyResponse.json()) as Record<string, unknown>;

      // H1: Validate response schema from Moltbook API
      if (
        !rawAgentData ||
        typeof rawAgentData !== 'object' ||
        typeof rawAgentData.id !== 'string' ||
        !rawAgentData.id
      ) {
        res.status(502).json({
          error: 'BadGateway',
          message: 'Invalid response from Moltbook verification service',
        });
        return;
      }

      const agentData = rawAgentData as {
        id: string;
        name: string;
        description?: string;
        karma?: number;
        avatar_url?: string;
        wallet_address?: string;
        claimed?: boolean;
        follower_count?: number;
      };

      const address = walletAddress.toLowerCase();

      // M3: If Moltbook returns a wallet_address, verify it matches the claimed one
      if (agentData.wallet_address && agentData.wallet_address.toLowerCase() !== address) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Wallet address does not match the Moltbook agent identity',
        });
        return;
      }

      // Find or create bot user
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ moltbookAgentId: agentData.id }, { walletAddress: address }],
        },
      });

      // H1: Cross-check identity to prevent confusion attacks
      if (user) {
        if (user.moltbookAgentId === agentData.id && user.walletAddress !== address) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Moltbook agent ID is already linked to a different wallet address.',
          });
          return;
        }
        if (
          user.walletAddress === address &&
          user.moltbookAgentId &&
          user.moltbookAgentId !== agentData.id
        ) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'Wallet address is already linked to a different Moltbook agent.',
          });
          return;
        }
      }

      // C3: Block role escalation from human to bot
      if (user && user.role === 'human') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot change role from human to bot. Create a new account.',
        });
        return;
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress: address,
            username: `bot_${agentData.name?.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) || address.slice(2, 10)}`,
            displayName: agentData.name || `Bot ${address.slice(2, 8)}`,
            avatarUrl: agentData.avatar_url || null,
            role: 'bot',
            moltbookAgentId: agentData.id,
            moltbookAgentName: agentData.name || null,
            moltbookKarma: agentData.karma || 0,
            botVerified: true,
            lastLoginAt: new Date(),
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'bot',
            moltbookAgentId: agentData.id,
            moltbookAgentName: agentData.name || user.displayName,
            moltbookKarma: agentData.karma || user.reputationTotal,
            botVerified: true,
            lastLoginAt: new Date(),
          },
        });
      }

      // Issue JWT
      const token = signToken(user.id, address);

      res.cookie('moltblox_token', token, TOKEN_COOKIE_OPTIONS);

      res.json({
        user: {
          id: user.id,
          address: user.walletAddress,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: 'bot',
          moltbookAgentId: agentData.id,
          moltbookAgentName: agentData.name,
          moltbookKarma: agentData.karma,
          botVerified: true,
        },
        expiresIn: '24h',
      });
    } catch (error: unknown) {
      if (error instanceof TypeError && (error as Error).message?.includes('fetch')) {
        res.status(502).json({
          error: 'BadGateway',
          message: 'Unable to reach Moltbook verification service',
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /auth/logout - Clear authentication cookie and blocklist the token
 */
router.post('/logout', async (req, res, next) => {
  try {
    // Blocklist the current token so it cannot be reused
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : req.cookies?.moltblox_token;

    if (token) {
      try {
        // Decode without verifying (token is already authenticated or about to be cleared)
        const decoded = jwt.decode(token) as { jti?: string } | null;
        // Use jti if present, otherwise blocklist by raw token
        const key = decoded?.jti || token;
        await blockToken(key);
      } catch {
        // If decoding fails, blocklist the raw token string
        await blockToken(token);
      }
    }

    res.clearCookie('moltblox_token', TOKEN_COOKIE_OPTIONS);
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

export default router;
