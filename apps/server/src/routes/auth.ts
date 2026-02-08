/**
 * Authentication routes for Moltblox API
 * Sign-In with Ethereum (SIWE) flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import jwt from 'jsonwebtoken';
import { signToken, extractBlocklistKey, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifySchema, moltbookAuthSchema, updateProfileSchema } from '../schemas/auth.js';
import { sanitizeObject } from '../lib/sanitize.js';
import { blockToken } from '../lib/tokenBlocklist.js';
import { hashApiKey } from '../lib/crypto.js';

// H1: Validate Moltbook API URL against allowlist to prevent SSRF
const MOLTBOOK_ALLOWED_HOSTS = ['https://www.moltbook.com/api/v1', 'https://api.moltbook.com/v1'];
const rawMoltbookUrl = process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1';
if (!MOLTBOOK_ALLOWED_HOSTS.includes(rawMoltbookUrl)) {
  throw new Error(
    `FATAL: MOLTBOOK_API_URL "${rawMoltbookUrl}" is not in the allowlist. ` +
      `Allowed: ${MOLTBOOK_ALLOWED_HOSTS.join(', ')}`,
  );
}
const MOLTBOOK_API_URL = rawMoltbookUrl;
const MOLTBOOK_APP_KEY =
  process.env.MOLTBOOK_APP_KEY ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: MOLTBOOK_APP_KEY must be set in production');
    }
    return '';
  })();

const router: Router = Router();

/**
 * GET /auth/csrf - Get CSRF token (also sets cookie)
 * Called by frontend on app initialization
 */
router.get('/csrf', (req: Request, res: Response) => {
  // The csrfTokenSetter middleware already sets the cookie if missing
  const token = req.cookies?.moltblox_csrf;
  res.json({ csrfToken: token || 'pending' });
});

/**
 * GET /auth/nonce - Get a nonce for SIWE
 * The client includes this nonce in the SIWE message to prevent replay attacks.
 */
router.get('/nonce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nonce = randomUUID();
    await redis.set(nonce, '1', 'EX', 300); // 5 minute TTL

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

      // Parse and verify the SIWE message
      const siweMessage = new SiweMessage(message);

      // Validate nonce
      const siweNonce = siweMessage.nonce;
      if (!siweNonce || !(await redis.exists(siweNonce))) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired nonce. Request a new one.',
        });
        return;
      }
      // Consume nonce (one-time use)
      await redis.del(siweNonce);

      const { data: verified } = await siweMessage.verify({ signature });

      const address = verified.address.toLowerCase();

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

      res.cookie('moltblox_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      res.json({
        user: {
          id: user.id,
          address: user.walletAddress,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        expiresIn: '7d',
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message?.includes('Signature') || error.message?.includes('verify'))
      ) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid SIWE signature',
        });
        return;
      }
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
    if (oldToken) {
      await blockToken(extractBlocklistKey(oldToken));
    }

    const token = signToken(user.id, user.address);

    res.cookie('moltblox_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({
      expiresIn: '7d',
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
 * PUT /auth/profile - Update user profile (auth required)
 */
router.put(
  '/profile',
  requireAuth,
  validate(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, displayName, bio, avatarUrl } = req.body;

      // Sanitize user input
      const sanitized = sanitizeObject({ displayName, bio } as Record<string, unknown>, [
        'displayName',
        'bio',
      ]);

      // H4: Reject data: URIs and javascript: URIs in avatarUrl
      if (avatarUrl !== undefined) {
        const lower = avatarUrl.toLowerCase();
        if (lower.startsWith('data:') || lower.startsWith('javascript:')) {
          res.status(400).json({
            error: 'BadRequest',
            message:
              'avatarUrl must be an https:// URL. data: and javascript: URIs are not allowed.',
          });
          return;
        }
      }

      const updateData: Record<string, string> = {};
      if (username !== undefined) updateData.username = username;
      if (displayName !== undefined) updateData.displayName = sanitized.displayName as string;
      if (bio !== undefined) updateData.bio = sanitized.bio as string;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

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
        },
      });

      res.json({ user, message: 'Profile updated' });
    } catch (error) {
      next(error);
    }
  },
);

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

      res.cookie('moltblox_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

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
        expiresIn: '7d',
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

    res.clearCookie('moltblox_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
    });
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

export default router;
