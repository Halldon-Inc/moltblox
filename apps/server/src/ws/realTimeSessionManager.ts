/**
 * Real-Time Session Manager
 *
 * Manages tick-based game loops for real-time games (e.g., OpenBOR fighter).
 * Unlike the turn-based sessionManager, this runs a server-side setInterval
 * at 60 fps (configurable via adapter.tickRate), flushing buffered inputs
 * through the adapter each frame and broadcasting state to all connected
 * players and spectators.
 *
 * Frame broadcast strategy:
 *   - Every frame: broadcast delta (position + HP changes only)
 *   - Every 3rd frame: broadcast full state snapshot
 *   - On game over: broadcast match_end with scores and winner
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import type { InputJsonValue } from '../generated/prisma/internal/prismaNamespace.js';
import {
  setSession,
  deleteSession,
  setPlayerSession,
  deletePlayerSession,
  publishMatchFound,
  type ActiveSessionData,
} from './redisSessionStore.js';
import {
  sendTo,
  broadcastToSession,
  type ConnectedClient,
  type WSMessage,
} from './sessionManager.js';

// =========================================================================
// Types
// =========================================================================

/**
 * Minimal adapter interface consumed by the session manager.
 * Matches OpenBORAdapter's public API without importing the class directly,
 * keeping the dependency one-directional (server depends on game-builder at
 * runtime only when creating sessions).
 */
interface RealTimeAdapter {
  readonly name: string;
  readonly maxPlayers: number;
  tickRate: number;
  initialize(playerIds: string[]): void;
  handleAction(
    playerId: string,
    action: { type: string; payload: Record<string, unknown>; timestamp: number },
  ): { success: boolean; error?: string };
  tick(): {
    frame: number;
    fighters: Record<string, unknown>;
    matchState: {
      phase: string;
      winner: string | null;
      roundNumber: number;
      roundsP1: number;
      roundsP2: number;
      timeRemaining: number;
    };
  };
  getLastSnapshot(): {
    frame: number;
    fighters: Record<string, unknown>;
    matchState: {
      phase: string;
      winner: string | null;
      roundNumber: number;
      roundsP1: number;
      roundsP2: number;
      timeRemaining: number;
    };
  } | null;
  computeDelta(
    prev: { frame: number; fighters: Record<string, unknown>; matchState: Record<string, unknown> },
    cur: { frame: number; fighters: Record<string, unknown>; matchState: Record<string, unknown> },
  ): Record<string, unknown>[];
  isGameOver(): boolean;
  getWinner(): string | null;
  getScores(): Record<string, number>;
  getState(): { turn: number; phase: string; data: Record<string, unknown> };
  dispose?(): void;
}

interface RealTimeSession {
  sessionId: string;
  gameId: string;
  playerIds: string[];
  adapter: RealTimeAdapter;
  tickInterval: ReturnType<typeof setInterval> | null;
  frameNumber: number;
  inputBuffers: Map<string, number>;
  spectators: Set<string>;
  ended: boolean;
  readyPlayers: Set<string>;
  previousSnapshot: {
    frame: number;
    fighters: Record<string, unknown>;
    matchState: Record<string, unknown>;
  } | null;
}

// =========================================================================
// Named input map (mirrored from OpenBORAdapter for convenience)
// =========================================================================

const INPUT_MAP: Record<string, number> = {
  move_left: 0b00000001,
  move_right: 0b00000010,
  move_up: 0b00000100,
  move_down: 0b00001000,
  attack1: 0b00010000,
  attack2: 0b00100000,
  jump: 0b01000000,
  special: 0b10000000,
};

// =========================================================================
// RealTimeSessionManager
// =========================================================================

export class RealTimeSessionManager {
  private sessions = new Map<string, RealTimeSession>();
  private playerToSession = new Map<string, string>();

  // -------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------

  /**
   * Create a new real-time session, start the tick loop, and notify players.
   */
  async createSession(
    gameId: string,
    playerIds: string[],
    adapter: RealTimeAdapter,
    clients: Map<string, ConnectedClient>,
  ): Promise<string> {
    const sessionId = uuidv4();

    // Initialize the adapter with player IDs
    adapter.initialize(playerIds);

    const session: RealTimeSession = {
      sessionId,
      gameId,
      playerIds,
      adapter,
      tickInterval: null,
      frameNumber: 0,
      inputBuffers: new Map(),
      spectators: new Set(),
      ended: false,
      readyPlayers: new Set(),
      previousSnapshot: null,
    };

    this.sessions.set(sessionId, session);
    for (const pid of playerIds) {
      this.playerToSession.set(pid, sessionId);
    }

    // Persist session to database
    const dbSession = await prisma.gameSession.create({
      data: {
        id: sessionId,
        gameId,
        status: 'active',
        state: adapter.getState() as unknown as InputJsonValue,
        currentTurn: 0,
        players: {
          create: playerIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true },
    });

    // Store in Redis for cross-instance discovery
    const activeSession: ActiveSessionData = {
      sessionId: dbSession.id,
      gameId,
      playerIds,
      gameState: adapter.getState(),
      currentTurn: 0,
      actionHistory: [],
      events: [],
      ended: false,
    };
    await setSession(redis, dbSession.id, activeSession);

    for (const pid of playerIds) {
      await setPlayerSession(redis, pid, dbSession.id);
    }

    await publishMatchFound(redis, dbSession.id, gameId, playerIds);

    // Notify matched players
    for (const [, client] of clients) {
      if (client.playerId && playerIds.includes(client.playerId)) {
        client.gameSessionId = sessionId;
        sendTo(client.ws, {
          type: 'realtime_match_found',
          payload: {
            sessionId,
            gameId,
            players: playerIds,
            tickRate: adapter.tickRate,
          },
        });
      }
    }

    console.log(
      `[RT] Session ${sessionId} created for game ${gameId} with ${playerIds.length} players`,
    );

    return sessionId;
  }

  /**
   * Mark a player as ready. When all players are ready, start the countdown
   * then begin the tick loop.
   */
  async handleReady(playerId: string, clients: Map<string, ConnectedClient>): Promise<void> {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return;

    session.readyPlayers.add(playerId);

    // Check if all players are ready
    if (session.readyPlayers.size >= session.playerIds.length) {
      await this.startCountdown(session, clients);
    }
  }

  /**
   * Run a 3-second countdown then start the tick loop.
   */
  private async startCountdown(
    session: RealTimeSession,
    clients: Map<string, ConnectedClient>,
  ): Promise<void> {
    // Broadcast countdown
    for (let seconds = 3; seconds > 0; seconds--) {
      this.broadcastToRealTimeSession(session, clients, {
        type: 'realtime_countdown',
        payload: { sessionId: session.sessionId, seconds },
      });
      await sleep(1000);
    }

    // Start the tick loop
    this.startTickLoop(session, clients);
  }

  /**
   * Begin the server-side tick loop at the adapter's configured tick rate.
   */
  private startTickLoop(session: RealTimeSession, clients: Map<string, ConnectedClient>): void {
    if (session.tickInterval) return; // already running

    const intervalMs = Math.floor(1000 / session.adapter.tickRate);

    session.tickInterval = setInterval(() => {
      if (session.ended) {
        if (session.tickInterval) {
          clearInterval(session.tickInterval);
          session.tickInterval = null;
        }
        return;
      }

      try {
        this.tickSession(session, clients);
      } catch (err) {
        console.error(`[RT] Tick error in session ${session.sessionId}:`, err);
      }
    }, intervalMs);

    console.log(
      `[RT] Tick loop started for session ${session.sessionId} at ${session.adapter.tickRate} fps`,
    );
  }

  // -------------------------------------------------------------------
  // Input handling
  // -------------------------------------------------------------------

  /**
   * Buffer a player's input for the next tick.
   * Accepts either a raw bitfield number or a named action string.
   */
  handleInput(playerId: string, input: number | string): void {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return;

    // Forward to the adapter's processAction (which buffers internally)
    const action = {
      type: 'realtime_input',
      payload: { input } as Record<string, unknown>,
      timestamp: Date.now(),
    };
    session.adapter.handleAction(playerId, action);
  }

  // -------------------------------------------------------------------
  // Tick execution
  // -------------------------------------------------------------------

  /**
   * Execute one tick: advance the adapter, broadcast results.
   */
  private tickSession(session: RealTimeSession, clients: Map<string, ConnectedClient>): void {
    const snapshot = session.adapter.tick();
    session.frameNumber = snapshot.frame;

    // Determine what to broadcast
    const isFullFrame = snapshot.frame % 3 === 0;

    if (isFullFrame || !session.previousSnapshot) {
      // Full state broadcast every 3rd frame (or on first frame)
      this.broadcastToRealTimeSession(session, clients, {
        type: 'realtime_state',
        payload: {
          sessionId: session.sessionId,
          frame: snapshot.frame,
          fighters: snapshot.fighters,
          matchState: snapshot.matchState,
        },
      });
    } else {
      // Delta broadcast on other frames
      const changes = session.adapter.computeDelta(
        session.previousSnapshot as {
          frame: number;
          fighters: Record<string, unknown>;
          matchState: Record<string, unknown>;
        },
        snapshot as {
          frame: number;
          fighters: Record<string, unknown>;
          matchState: Record<string, unknown>;
        },
      );
      if (changes.length > 0) {
        this.broadcastToRealTimeSession(session, clients, {
          type: 'realtime_delta',
          payload: {
            sessionId: session.sessionId,
            frame: snapshot.frame,
            changes,
          },
        });
      }
    }

    session.previousSnapshot = snapshot as {
      frame: number;
      fighters: Record<string, unknown>;
      matchState: Record<string, unknown>;
    };

    // Check for game over
    if (session.adapter.isGameOver()) {
      this.endSession(session.sessionId, clients).catch((err) => {
        console.error(`[RT] Error ending session ${session.sessionId}:`, err);
      });
    }
  }

  // -------------------------------------------------------------------
  // Session end
  // -------------------------------------------------------------------

  /**
   * Stop the tick loop, persist results, notify players.
   */
  async endSession(sessionId: string, clients: Map<string, ConnectedClient>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return;

    session.ended = true;

    // Stop tick loop
    if (session.tickInterval) {
      clearInterval(session.tickInterval);
      session.tickInterval = null;
    }

    const winner = session.adapter.getWinner();
    const scores = session.adapter.getScores();

    // Broadcast match end
    this.broadcastToRealTimeSession(session, clients, {
      type: 'realtime_match_end',
      payload: {
        sessionId,
        winner,
        scores,
        finalState: session.adapter.getLastSnapshot(),
      },
    });

    // Persist to database
    try {
      await prisma.$transaction(async (tx) => {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            scores,
            winnerId: winner,
            endedAt: new Date(),
            currentTurn: session.frameNumber,
            state: session.adapter.getState() as unknown as InputJsonValue,
          },
        });

        // Increment game stats
        const previousPlayers = await tx.gameSessionPlayer.findMany({
          where: {
            session: { gameId: session.gameId, id: { not: sessionId } },
            userId: { in: session.playerIds },
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        const previousPlayerIds = new Set(previousPlayers.map((p) => p.userId));
        const newPlayerCount = session.playerIds.filter((id) => !previousPlayerIds.has(id)).length;

        await tx.game.update({
          where: { id: session.gameId },
          data: {
            totalPlays: { increment: 1 },
            uniquePlayers: { increment: newPlayerCount },
          },
        });
      });
    } catch (err) {
      console.error(`[RT] Failed to persist session ${sessionId}:`, err);
    }

    // Clear client session bindings
    for (const [, client] of clients) {
      if (client.gameSessionId === sessionId) {
        client.gameSessionId = undefined;
      }
    }

    // Clean up Redis
    for (const pid of session.playerIds) {
      await deletePlayerSession(redis, pid);
    }
    await deleteSession(redis, sessionId);

    // Clean up adapter
    if (session.adapter.dispose) {
      session.adapter.dispose();
    }

    // Clean up internal maps
    for (const pid of session.playerIds) {
      this.playerToSession.delete(pid);
    }
    for (const spectatorId of session.spectators) {
      this.playerToSession.delete(spectatorId);
    }
    this.sessions.delete(sessionId);

    console.log(`[RT] Session ${sessionId} ended. Winner: ${winner ?? 'none'}`);
  }

  // -------------------------------------------------------------------
  // Spectating
  // -------------------------------------------------------------------

  handleSpectate(clientId: string, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.spectators.add(clientId);
  }

  handleStopSpectating(clientId: string, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.spectators.delete(clientId);
  }

  // -------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------

  async handleDisconnect(
    clientId: string,
    playerId: string | undefined,
    clients: Map<string, ConnectedClient>,
  ): Promise<void> {
    if (!playerId) return;

    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from spectators if applicable
    session.spectators.delete(clientId);

    // Check if the player was a participant
    if (session.playerIds.includes(playerId)) {
      // Notify remaining players
      this.broadcastToRealTimeSession(session, clients, {
        type: 'player_disconnected',
        payload: {
          playerId,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      });

      // If all players have disconnected, end the session
      const remainingClients = [...clients.values()].filter(
        (c) => c.id !== clientId && c.gameSessionId === sessionId,
      );
      if (remainingClients.length === 0) {
        await this.endSession(sessionId, clients);
      }
    }
  }

  // -------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------

  isRealTimeSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getSessionForPlayer(playerId: string): string | undefined {
    return this.playerToSession.get(playerId);
  }

  // -------------------------------------------------------------------
  // Broadcast helpers
  // -------------------------------------------------------------------

  private broadcastToRealTimeSession(
    session: RealTimeSession,
    clients: Map<string, ConnectedClient>,
    message: WSMessage,
  ): void {
    for (const [, client] of clients) {
      if (client.gameSessionId === session.sessionId || session.spectators.has(client.id)) {
        sendTo(client.ws, message);
      }
    }
  }
}

// =========================================================================
// Utility
// =========================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
