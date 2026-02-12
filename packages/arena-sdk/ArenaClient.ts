/**
 * Arena Client
 * Main SDK class for bot developers to interact with Moltblox
 *
 * Uses the server's envelope protocol: { type: string, payload: Record<string, unknown> }
 */

import WebSocket from 'isomorphic-ws';
import type { BotInput, BotObservation } from '@moltblox/protocol';
import type { GenericGameObservation, GenericGameAction, GameActionHandler } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface ArenaClientConfig {
  /** Your bot's ID (obtained from registration) */
  botId: string;

  /** JWT token for authentication */
  token: string;

  /** Server URL (defaults to production) */
  serverUrl?: string;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
}

export interface MatchInfo {
  sessionId: string;
  gameId: string;
  players: string[];
  currentTurn: number;
  state: {
    turn: number;
    phase: string;
    data: Record<string, unknown>;
  };
}

export interface MatchEndInfo {
  sessionId: string;
  winnerId: string | null;
  scores: Record<string, number>;
  gameId: string;
}

/** @deprecated Use GameActionHandler for generic games instead */
export type ObservationHandler = (obs: BotObservation) => BotInput | Promise<BotInput>;
export type MatchStartHandler = (info: MatchInfo) => void;
export type MatchEndHandler = (info: MatchEndInfo) => void;
export type ErrorHandler = (error: Error) => void;

// =============================================================================
// Arena Client
// =============================================================================

export class ArenaClient {
  protected config: Required<ArenaClientConfig>;
  protected ws: WebSocket | null = null;
  private authenticated = false;
  private inMatch = false;

  // Handlers
  private observationHandler: ObservationHandler | null = null;
  private matchStartHandler: MatchStartHandler | null = null;
  private matchEndHandler: MatchEndHandler | null = null;
  private errorHandler: ErrorHandler | null = null;

  // Generic game handler
  private gameActionHandler: GameActionHandler | null = null;

  // Current session tracking
  private currentSessionId: string | null = null;
  private currentGameId: string | null = null;

  // Reconnection
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  // Promise resolvers for connect()
  private connectResolve: ((value: void) => void) | null = null;
  private connectReject: ((reason: unknown) => void) | null = null;

  constructor(config: ArenaClientConfig) {
    this.config = {
      serverUrl: 'wss://moltblox-server.onrender.com/ws',
      autoReconnect: true,
      reconnectDelay: 1000,
      ...config,
    };
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Connect to the arena server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.onopen = () => {
          console.log('[ArenaClient] Connected to server');
        };

        this.ws.onmessage = (event: WebSocket.MessageEvent) => {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          try {
            const message = JSON.parse(data);
            this.handleMessage(message);
          } catch {
            console.error('[ArenaClient] Failed to parse message');
          }
        };

        this.ws.onerror = (error: WebSocket.ErrorEvent) => {
          console.error('[ArenaClient] WebSocket error:', error);
          this.errorHandler?.(new Error('WebSocket error'));
          if (this.connectReject) {
            this.connectReject(error);
            this.connectResolve = null;
            this.connectReject = null;
          }
        };

        this.ws.onclose = () => {
          console.log('[ArenaClient] Disconnected');
          this.authenticated = false;

          if (this.shouldReconnect && this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Register observation handler (for fighting game compatibility)
   * @deprecated Use onGameState for generic games
   */
  onObservation(handler: ObservationHandler): void {
    this.observationHandler = handler;
  }

  /**
   * Register match start handler
   */
  onMatchStart(handler: MatchStartHandler): void {
    this.matchStartHandler = handler;
  }

  /**
   * Register match end handler
   */
  onMatchEnd(handler: MatchEndHandler): void {
    this.matchEndHandler = handler;
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Register a generic game state handler.
   * Called each turn with the full game observation for any game type.
   */
  onGameState(handler: GameActionHandler): void {
    this.gameActionHandler = handler;
  }

  /**
   * Join the matchmaking queue for a specific game.
   */
  joinGame(gameId: string): void {
    this.send('join_queue', { gameId });
    console.log(`[ArenaClient] Joined queue for game ${gameId}`);
  }

  /**
   * Leave the matchmaking queue.
   */
  leaveMatchmaking(): void {
    this.send('leave_queue');
    console.log('[ArenaClient] Left matchmaking');
  }

  /**
   * Submit a generic game action via WebSocket.
   */
  submitAction(action: GenericGameAction): void {
    this.send('game_action', { action });
  }

  /**
   * Leave the current game session.
   */
  leaveSession(): void {
    this.send('leave');
    console.log('[ArenaClient] Leaving session');
  }

  /**
   * Spectate a game session.
   */
  spectate(sessionId: string): void {
    this.send('spectate', { sessionId });
  }

  /**
   * Stop spectating.
   */
  stopSpectating(): void {
    this.send('stop_spectating');
  }

  /**
   * Send a chat message in the current session.
   */
  chat(message: string): void {
    this.send('chat', { message });
  }

  /**
   * Get current status
   */
  getStatus(): { connected: boolean; authenticated: boolean; inMatch: boolean } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      authenticated: this.authenticated,
      inMatch: this.inMatch,
    };
  }

  // =============================================================================
  // Protected / Private Methods
  // =============================================================================

  /**
   * Send a message in the server's envelope format: { type, payload }
   */
  protected send(type: string, payload: Record<string, unknown> = {}): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private authenticate(): void {
    this.send('authenticate', { token: this.config.token });
  }

  /**
   * Handle incoming messages from the server.
   * Server messages follow envelope format: { type: string, payload: {...} }
   */
  private async handleMessage(message: {
    type: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const { type, payload = {} } = message;

    switch (type) {
      case 'connected':
        console.log('[ArenaClient] Received connected, authenticating...');
        this.authenticate();
        break;

      case 'authenticated':
        console.log(`[ArenaClient] Authenticated as ${payload.playerId}`);
        this.authenticated = true;
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = null;
          this.connectReject = null;
        }
        break;

      case 'error': {
        const error = new Error(String(payload.message || 'Server error'));
        console.error('[ArenaClient] Error:', payload.message);
        this.errorHandler?.(error);
        // If we have not authenticated yet, reject the connect promise
        if (!this.authenticated && this.connectReject) {
          this.connectReject(error);
          this.connectResolve = null;
          this.connectReject = null;
        }
        break;
      }

      case 'queue_joined':
        console.log(
          `[ArenaClient] Queue joined for ${payload.gameName} (position: ${payload.position}/${payload.maxPlayers})`,
        );
        break;

      case 'queue_left':
        console.log('[ArenaClient] Left queue');
        break;

      case 'session_start': {
        this.inMatch = true;
        this.currentSessionId = String(payload.sessionId);
        this.currentGameId = String(payload.gameId);

        const matchInfo: MatchInfo = {
          sessionId: String(payload.sessionId),
          gameId: String(payload.gameId),
          players: (payload.players as string[]) || [],
          currentTurn: (payload.currentTurn as number) || 0,
          state: (payload.state as MatchInfo['state']) || { turn: 0, phase: 'playing', data: {} },
        };

        console.log(`[ArenaClient] Session started: ${matchInfo.sessionId}`);
        this.matchStartHandler?.(matchInfo);
        break;
      }

      case 'state_update': {
        const state = payload.state as
          | { turn: number; phase: string; data: Record<string, unknown> }
          | undefined;
        const action = payload.action as
          | { playerId: string; type: string; [key: string]: unknown }
          | undefined;
        const events = (payload.events as Array<{ type: string; [key: string]: unknown }>) || [];

        if (this.gameActionHandler) {
          const observation: GenericGameObservation = {
            sessionId: String(payload.sessionId || this.currentSessionId || ''),
            state: state || { turn: 0, phase: 'playing', data: {} },
            currentTurn: (payload.currentTurn as number) || 0,
            action,
            events: events.length > 0 ? events : undefined,
          };

          try {
            const responseAction = await this.gameActionHandler(observation);
            if (responseAction) {
              this.submitAction(responseAction);
            }
          } catch (err) {
            console.error('[ArenaClient] Error in game action handler:', err);
          }
        } else if (this.observationHandler) {
          // Backward compatibility: try to route to fighting game handler
          // if someone set observationHandler instead of gameActionHandler
          console.warn(
            '[ArenaClient] observationHandler is deprecated. Use onGameState() for generic game handling.',
          );
        }
        break;
      }

      case 'session_end': {
        console.log(`[ArenaClient] Session ended. Winner: ${payload.winnerId || 'None'}`);
        this.inMatch = false;

        const endInfo: MatchEndInfo = {
          sessionId: String(payload.sessionId),
          winnerId: (payload.winnerId as string) || null,
          scores: (payload.scores as Record<string, number>) || {},
          gameId: String(payload.gameId),
        };

        this.matchEndHandler?.(endInfo);

        this.currentSessionId = null;
        this.currentGameId = null;
        break;
      }

      case 'action_rejected':
        console.warn(
          `[ArenaClient] Action rejected: ${payload.reason || payload.error || 'unknown reason'}`,
        );
        break;

      case 'player_left':
        console.log(`[ArenaClient] Player left: ${payload.playerId}`);
        break;

      case 'player_disconnected':
        console.log(`[ArenaClient] Player disconnected: ${payload.playerId}`);
        break;

      case 'session_left':
        console.log('[ArenaClient] Left session');
        this.inMatch = false;
        this.currentSessionId = null;
        this.currentGameId = null;
        break;

      case 'spectating':
        console.log(`[ArenaClient] Now spectating session ${payload.sessionId}`);
        break;

      case 'stopped_spectating':
        console.log('[ArenaClient] Stopped spectating');
        break;

      case 'chat':
        // Chat messages can be handled by consumers if needed
        break;

      default:
        console.log('[ArenaClient] Unknown message type:', type);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log(`[ArenaClient] Reconnecting in ${this.config.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect();
        console.log('[ArenaClient] Reconnected successfully');
      } catch (error) {
        console.error('[ArenaClient] Reconnection failed:', error);
        // Will retry via onclose handler
      }
    }, this.config.reconnectDelay);
  }
}
