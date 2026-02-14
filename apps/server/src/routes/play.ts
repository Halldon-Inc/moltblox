/**
 * REST Play Routes
 *
 * Authoritative server-side game play for template games.
 * Enables headless bots to play games via HTTP without WebSockets.
 *
 * Endpoints:
 *   POST   /games/:id/sessions                       Start a new game session
 *   POST   /games/:id/sessions/:sessionId/actions     Submit an action
 *   GET    /games/:id/sessions/:sessionId             Get current game state
 *   GET    /games/:id/spectate                        Get active sessions for spectating
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startSessionSchema,
  sessionParamsSchema,
  submitActionSchema,
  spectateQuerySchema,
} from '../schemas/games.js';
import { createGameInstance } from '../lib/gameFactory.js';
import {
  getSession,
  setSession,
  deleteSession,
  setPlayerSession,
  deletePlayerSession,
} from '../ws/redisSessionStore.js';
import type { ActiveSessionData } from '../ws/redisSessionStore.js';
import type { GameAction } from '@moltblox/protocol';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never>,
    prefix: `rl:${prefix}:`,
  });
}

const playWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('play'),
  keyGenerator: (req: Request) => req.user?.id || req.ip || 'unknown',
  message: { error: 'TooManyRequests', message: 'Play rate limit exceeded. Try again later.' },
});

const router: Router = Router();

/**
 * POST /games/:id/sessions - Start a new authoritative game session
 */
router.post(
  '/:id/sessions',
  playWriteLimiter,
  requireAuth,
  validate(startSessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const game = await prisma.game.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          templateSlug: true,
          maxPlayers: true,
          config: true,
          creatorId: true,
        },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      // Allow creators to playtest their own draft games
      if (game.status !== 'published' && game.creatorId !== user.id) {
        res.status(400).json({ error: 'BadRequest', message: 'Game is not published' });
        return;
      }

      // Per-player session limit: max 5 active sessions across all games
      const activeSessionCount = await prisma.gameSession.count({
        where: {
          status: 'active',
          endedAt: null,
          players: { some: { userId: user.id } },
        },
      });
      if (activeSessionCount >= 5) {
        res.status(429).json({
          error: 'TooManyRequests',
          message: 'Too many active sessions. Maximum 5 per player.',
        });
        return;
      }

      if (!game.templateSlug) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Game does not use a template. REST play requires a template game.',
        });
        return;
      }

      const gameConfig = (game.config as Record<string, unknown>) || undefined;
      if (game.templateSlug === 'state-machine') {
        const cfgKeys = gameConfig ? Object.keys(gameConfig) : [];
        const defKeys =
          gameConfig && typeof gameConfig.definition === 'object' && gameConfig.definition
            ? Object.keys(gameConfig.definition as Record<string, unknown>)
            : [];
        console.error(
          `[STATE_MACHINE] config keys: [${cfgKeys.join(', ')}], definition keys: [${defKeys.join(', ')}]`,
        );
      }
      let gameInstance;
      try {
        gameInstance = createGameInstance(game.templateSlug, gameConfig);
      } catch (err: unknown) {
        res.status(400).json({
          error: 'BadRequest',
          message: `Failed to create game: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      if (!gameInstance) {
        res.status(400).json({
          error: 'BadRequest',
          message: `Unknown template: ${game.templateSlug}`,
        });
        return;
      }

      const playerIds = [user.id];
      gameInstance.initialize(playerIds);
      const initialState = gameInstance.getStateForPlayer(user.id);
      const fullState = gameInstance.getState();

      const dbSession = await prisma.gameSession.create({
        data: {
          gameId: id,
          status: 'active',
          state: fullState as object,
          currentTurn: 0,
          players: { create: [{ userId: user.id }] },
        },
        select: { id: true },
      });

      const activeSession: ActiveSessionData = {
        sessionId: dbSession.id,
        gameId: id,
        templateSlug: game.templateSlug,
        gameConfig: gameConfig,
        playerIds,
        gameState: fullState,
        currentTurn: 0,
        actionHistory: [],
        events: [],
        ended: false,
      };
      await setSession(redis, dbSession.id, activeSession);
      await setPlayerSession(redis, user.id, dbSession.id);

      res.status(201).json({
        sessionId: dbSession.id,
        gameState: initialState,
        templateSlug: game.templateSlug,
        message: `Game session started. Use submit_action to play.`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /games/:id/sessions/:sessionId/actions - Submit a game action
 */
router.post(
  '/:id/sessions/:sessionId/actions',
  playWriteLimiter,
  requireAuth,
  validate(submitActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sessionId } = req.params;
      const user = req.user!;

      const session = await getSession(redis, sessionId);
      if (!session) {
        res.status(410).json({
          error: 'SessionExpired',
          message:
            'Session not found or expired. Start a new session with POST /api/v1/games/:gameId/sessions',
        });
        return;
      }

      if (!session.playerIds.includes(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'You are not a player in this session' });
        return;
      }

      if (session.gameId !== id) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Session does not belong to this game' });
        return;
      }

      if (session.ended) {
        res.status(400).json({ error: 'BadRequest', message: 'Session has already ended' });
        return;
      }

      const templateSlug = session.templateSlug;
      if (!templateSlug) {
        res.status(400).json({ error: 'BadRequest', message: 'Session has no template' });
        return;
      }

      let gameInstance;
      try {
        gameInstance = createGameInstance(templateSlug, session.gameConfig);
      } catch (err: unknown) {
        res.status(400).json({
          error: 'BadRequest',
          message: `Failed to load game: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      if (!gameInstance) {
        res.status(500).json({ error: 'InternalError', message: 'Failed to load game template' });
        return;
      }

      gameInstance.restoreState(session.playerIds, session.gameState);

      const gameAction: GameAction = {
        type: req.body.type,
        payload: req.body.payload || {},
        timestamp: Date.now(),
      };

      const result = gameInstance.handleAction(user.id, gameAction);

      if (!result.success) {
        res.status(400).json({
          error: 'ActionRejected',
          message: result.error || 'Action was rejected by game logic',
        });
        return;
      }

      const newState = gameInstance.getState();
      session.gameState = newState;
      session.currentTurn = newState.turn;
      session.actionHistory.push({
        playerId: user.id,
        action: gameAction,
        turn: newState.turn,
        timestamp: Date.now(),
      });
      if (session.actionHistory.length > 500) {
        session.actionHistory.shift();
      }
      if (result.events) {
        session.events.push(...result.events);
        if (session.events.length > 500) {
          session.events = session.events.slice(-500);
        }
      }

      const isGameOver = gameInstance.isGameOver();
      let winner: string | null = null;
      let scores: Record<string, number> = {};

      if (isGameOver) {
        session.ended = true;
        winner = gameInstance.getWinner();
        scores = gameInstance.getScores();

        await prisma.$transaction(async (tx) => {
          await tx.gameSession.update({
            where: { id: sessionId },
            data: {
              status: 'completed',
              currentTurn: newState.turn,
              state: newState as object,
              winnerId: winner || undefined,
              scores: scores as object,
              endedAt: new Date(),
            },
          });

          const priorSessionCount = await tx.gameSessionPlayer.count({
            where: { userId: user.id, session: { gameId: id } },
          });

          await tx.game.update({
            where: { id },
            data: {
              totalPlays: { increment: 1 },
              ...(priorSessionCount <= 1 ? { uniquePlayers: { increment: 1 } } : {}),
            },
          });
        });

        await deleteSession(redis, sessionId);
        await deletePlayerSession(redis, user.id);
      } else {
        await setSession(redis, sessionId, session);
      }

      const filteredState = gameInstance.getStateForPlayer(user.id);
      res.json({
        success: true,
        actionResult: {
          success: result.success,
          newState: filteredState,
          events: result.events || [],
        },
        turn: newState.turn,
        gameOver: isGameOver,
        ...(isGameOver ? { winner, scores } : {}),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /games/:id/sessions/:sessionId - Get current game state
 */
router.get(
  '/:id/sessions/:sessionId',
  requireAuth,
  validate(sessionParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sessionId } = req.params;
      const user = req.user!;

      const session = await getSession(redis, sessionId);
      if (!session) {
        res.status(410).json({
          error: 'SessionExpired',
          message:
            'Session not found or expired. Start a new session with POST /api/v1/games/:gameId/sessions',
        });
        return;
      }

      if (!session.playerIds.includes(user.id)) {
        res
          .status(403)
          .json({ error: 'Forbidden', message: 'You are not a player in this session' });
        return;
      }

      if (session.gameId !== id) {
        res
          .status(400)
          .json({ error: 'BadRequest', message: 'Session does not belong to this game' });
        return;
      }

      if (session.templateSlug) {
        let gameInstance;
        try {
          gameInstance = createGameInstance(session.templateSlug, session.gameConfig);
        } catch (err: unknown) {
          res.status(400).json({
            error: 'BadRequest',
            message: `Failed to load game: ${err instanceof Error ? err.message : String(err)}`,
          });
          return;
        }
        if (gameInstance) {
          gameInstance.restoreState(session.playerIds, session.gameState);
          const filteredState = gameInstance.getStateForPlayer(user.id);
          res.json({
            sessionId,
            gameState: filteredState,
            turn: session.currentTurn,
            ended: session.ended,
            templateSlug: session.templateSlug,
          });
          return;
        }
      }

      res.json({
        sessionId,
        gameState: session.gameState,
        turn: session.currentTurn,
        ended: session.ended,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /games/:id/spectate - Get active sessions available for spectating (public, no auth)
 */
router.get(
  '/:id/spectate',
  validate(spectateQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const game = await prisma.game.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found' });
        return;
      }

      const sessions = await prisma.gameSession.findMany({
        where: { gameId: id, status: 'active', endedAt: null },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          startedAt: true,
          currentTurn: true,
          state: true,
          _count: {
            select: { players: true },
          },
        },
      });

      res.json({
        sessions: sessions.map((s) => ({
          sessionId: s.id,
          playerCount: s._count.players,
          startedAt: s.startedAt.toISOString(),
          currentTurn: s.currentTurn,
          gameState: s.state,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /play-info - Document the play API endpoints (public, no auth)
 */
router.get('/play-info', (_req: Request, res: Response) => {
  res.json({
    description:
      'REST Play API for template games. All play endpoints require auth (Bearer token or X-API-Key).',
    endpoints: {
      start_session: {
        method: 'POST',
        path: '/api/v1/games/{gameId}/sessions',
        body: '{}',
        response: '{ sessionId, gameState, templateSlug, message }',
      },
      submit_action: {
        method: 'POST',
        path: '/api/v1/games/{gameId}/sessions/{sessionId}/actions',
        body: '{ type: "click"|"move"|"fight"|..., payload: {} }',
        response: '{ success, actionResult: { success, newState, events }, turn, gameOver }',
      },
      get_session_state: {
        method: 'GET',
        path: '/api/v1/games/{gameId}/sessions/{sessionId}',
        response: '{ sessionId, gameState, turn, ended }',
      },
      spectate: {
        method: 'GET',
        path: '/api/v1/games/{gameId}/spectate',
        query: '?limit=10 (default 10, max 50)',
        response: '{ sessions: [{ sessionId, playerCount, startedAt, currentTurn, gameState }] }',
        auth: 'none (public)',
      },
    },
    notes: [
      'Game must be published and use a templateSlug (clicker, puzzle, creature-rpg, rpg, rhythm, platformer, side-battler)',
      'Sessions are stored in Redis with 24h TTL',
      'If session is expired, you get 410 (SessionExpired) not 404',
      'Action types depend on the template. See start_session response for templateSlug.',
    ],
  });
});

/**
 * GET /active-sessions - List active game sessions for spectating (public, no auth)
 */
router.get('/active-sessions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { endedAt: null, status: 'active' },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        gameId: true,
        startedAt: true,
        currentTurn: true,
        game: {
          select: {
            name: true,
            templateSlug: true,
          },
        },
        _count: {
          select: { players: true },
        },
      },
    });

    res.json({
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        gameId: s.gameId,
        gameName: s.game.name,
        templateSlug: s.game.templateSlug,
        playerCount: s._count.players,
        startedAt: s.startedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
