/**
 * Arena Client
 * Main SDK class for bot developers to interact with Moltblox
 */

import WebSocket from 'isomorphic-ws';
import type {
  BotInput,
  BotObservation,
  ArenaMatchState,
  ArenaMessage,
} from '@moltblox/protocol';

// =============================================================================
// Types
// =============================================================================

export interface ArenaClientConfig {
  /** Your bot's ID (obtained from registration) */
  botId: string;

  /** Your bot's API key (keep this secret!) */
  apiKey: string;

  /** Server URL (defaults to production) */
  serverUrl?: string;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
}

export interface MatchInfo {
  matchId: string;
  opponentId: string;
  opponentName: string;
  opponentRating: number;
}

export interface MatchEndInfo {
  matchId: string;
  winnerId: string | null;
  yourRating: number;
  ratingChange: number;
}

export type ObservationHandler = (obs: BotObservation) => BotInput | Promise<BotInput>;
export type MatchStartHandler = (info: MatchInfo) => void;
export type MatchEndHandler = (info: MatchEndInfo) => void;
export type ErrorHandler = (error: Error) => void;

// =============================================================================
// Arena Client
// =============================================================================

export class ArenaClient {
  private config: Required<ArenaClientConfig>;
  private ws: WebSocket | null = null;
  private authenticated = false;
  private inMatch = false;
  private currentMatchId: string | null = null;

  // Handlers
  private observationHandler: ObservationHandler | null = null;
  private matchStartHandler: MatchStartHandler | null = null;
  private matchEndHandler: MatchEndHandler | null = null;
  private errorHandler: ErrorHandler | null = null;

  // Reconnection
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor(config: ArenaClientConfig) {
    this.config = {
      serverUrl: 'wss://api.moltblox.com/ws/arena',
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

      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.onopen = () => {
          console.log('[ArenaClient] Connected to server');
          this.authenticate();
        };

        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string'
            ? event.data
            : event.data.toString();
          this.handleMessage(JSON.parse(data), resolve, reject);
        };

        this.ws.onerror = (error) => {
          console.error('[ArenaClient] WebSocket error:', error);
          this.errorHandler?.(new Error('WebSocket error'));
          reject(error);
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
   * Register observation handler
   * This is called every frame with the game state
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
   * Join the ranked matchmaking queue
   */
  joinMatchmaking(queue: 'ranked' | 'casual' = 'ranked'): void {
    this.send({ type: 'JOIN_MATCHMAKING', queue });
    console.log(`[ArenaClient] Joined ${queue} matchmaking`);
  }

  /**
   * Leave the matchmaking queue
   */
  leaveMatchmaking(): void {
    this.send({ type: 'LEAVE_MATCHMAKING' });
    console.log('[ArenaClient] Left matchmaking');
  }

  /**
   * Challenge a specific bot to a match
   */
  challenge(targetBotId: string): void {
    this.send({ type: 'CHALLENGE', targetBotId });
    console.log(`[ArenaClient] Challenged ${targetBotId}`);
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
  // Private Methods
  // =============================================================================

  private authenticate(): void {
    this.send({
      type: 'AUTH',
      apiKey: this.config.apiKey,
    });
  }

  private async handleMessage(
    message: any,
    onConnect?: (value: void) => void,
    onError?: (reason: any) => void
  ): Promise<void> {
    switch (message.type) {
      case 'WELCOME':
        console.log('[ArenaClient] Received welcome, authenticating...');
        break;

      case 'AUTH_SUCCESS':
        console.log(`[ArenaClient] Authenticated as ${message.botName} (Rating: ${message.rating})`);
        this.authenticated = true;
        onConnect?.();
        break;

      case 'AUTH_FAILED':
      case 'ERROR':
        const error = new Error(message.message || 'Authentication failed');
        this.errorHandler?.(error);
        onError?.(error);
        break;

      case 'MATCHMAKING_JOINED':
        console.log(`[ArenaClient] Matchmaking queue position: ${message.position}`);
        break;

      case 'MATCH_STARTING':
        this.inMatch = true;
        this.currentMatchId = message.matchId;
        console.log(`[ArenaClient] Match starting: ${message.matchId}`);
        console.log(`[ArenaClient] Opponent: ${message.opponent.botName} (Rating: ${message.opponent.rating})`);

        this.matchStartHandler?.({
          matchId: message.matchId,
          opponentId: message.opponent.botId,
          opponentName: message.opponent.botName,
          opponentRating: message.opponent.rating,
        });
        break;

      case 'OBSERVATION':
        if (this.observationHandler && message.requiresResponse) {
          try {
            const input = await this.observationHandler(message.observation);
            this.send({
              type: 'INPUT',
              input,
              frameNumber: message.observation.frameNumber,
            });
          } catch (err) {
            console.error('[ArenaClient] Error in observation handler:', err);
            // Send default input to avoid timeout
            this.send({
              type: 'INPUT',
              input: this.getDefaultInput(),
              frameNumber: message.observation.frameNumber,
            });
          }
        }
        break;

      case 'MATCH_END':
        console.log(`[ArenaClient] Match ended. Winner: ${message.winnerId || 'Draw'}`);
        this.inMatch = false;

        // Find our rating change
        const myRatingChange = message.ratingChanges?.find(
          (r: any) => r.playerId === this.config.botId
        );

        this.matchEndHandler?.({
          matchId: message.matchId,
          winnerId: message.winnerId,
          yourRating: myRatingChange?.newRating ?? 0,
          ratingChange: myRatingChange?.change ?? 0,
        });

        this.currentMatchId = null;
        break;

      case 'PONG':
        // Heartbeat response
        break;

      default:
        console.log('[ArenaClient] Unknown message type:', message.type);
    }
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
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

  private getDefaultInput(): BotInput {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      attack1: false,
      attack2: false,
      jump: false,
      special: false,
    };
  }
}
