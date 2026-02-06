/**
 * Authentication routes for Moltblox API
 * Sign-In with Ethereum (SIWE) flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SiweMessage } from 'siwe';
import { randomUUID, createHash } from 'crypto';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifySchema, moltbookAuthSchema, updateProfileSchema } from '../schemas/auth.js';
import { sanitizeObject } from '../lib/sanitize.js';

const MOLTBOOK_API_URL = process.env.MOLTBOOK_API_URL || 'https://www.moltbook.com/api/v1';
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY || '';

const router: Router = Router();

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

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

      if (!message || !signature) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing message or signature',
        });
        return;
      }

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
        secure: process.env.NODE_ENV === 'production',
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
 */
router.post('/refresh', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const token = signToken(user.id, user.address);

    res.cookie('moltblox_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

      if (!identityToken || !walletAddress) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing identityToken or walletAddress',
        });
        return;
      }

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

      const agentData = (await verifyResponse.json()) as {
        id: string;
        name: string;
        description?: string;
        karma?: number;
        avatar_url?: string;
        claimed?: boolean;
        follower_count?: number;
      };

      const address = walletAddress.toLowerCase();

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
        secure: process.env.NODE_ENV === 'production',
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
 * POST /auth/logout - Clear authentication cookie
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('moltblox_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out' });
});

export default router;
