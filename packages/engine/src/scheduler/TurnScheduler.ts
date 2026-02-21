/**
 * Turn Scheduler
 *
 * Manages turn timing, action collection, and fairness between players.
 * Supports both turn-based and real-time games with latency compensation.
 */

import { createHash } from 'crypto';
import type { GameAction as Action } from '@moltblox/protocol';

// =============================================================================
// Types
// =============================================================================

export interface TurnSchedulerConfig {
  /** Turn-based or real-time mode */
  mode: 'turn-based' | 'real-time' | 'simultaneous';

  /** Maximum time per turn in milliseconds */
  turnTimeout: number;

  /** Server tick rate for real-time games */
  tickRate: number;

  /** Buffer time for inputs in real-time mode (ms) */
  inputBuffer: number;

  /** Enable latency compensation */
  networkCompensation: boolean;

  /** Maximum allowed latency before timeout (ms) */
  maxLatencyAllowance: number;
}

export interface PendingAction {
  playerId: string;
  action: Action;
  clientTimestamp: number;
  serverTimestamp: number;
  adjustedTimestamp: number;
}

export interface LatencyProfile {
  playerId: string;
  samples: number[];
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  jitter: number;
}

export interface TurnResult {
  /** Actions collected this turn */
  actions: Map<string, Action>;

  /** Players who timed out */
  timedOut: string[];

  /** Turn duration in milliseconds */
  duration: number;
}

// =============================================================================
// Turn Scheduler Implementation
// =============================================================================

export class TurnScheduler {
  private config: TurnSchedulerConfig;
  private players: Set<string> = new Set();
  private pendingActions: Map<string, PendingAction> = new Map();
  private commitments: Map<string, string> = new Map(); // For simultaneous reveals
  private latencyProfiles: Map<string, LatencyProfile> = new Map();
  private turnStartTime: number = 0;
  private currentTurn: number = 0;

  constructor(config: Partial<TurnSchedulerConfig> = {}) {
    this.config = {
      mode: 'turn-based',
      turnTimeout: 30000, // 30 seconds
      tickRate: 60,
      inputBuffer: 100,
      networkCompensation: true,
      maxLatencyAllowance: 500,
      ...config,
    };
  }

  // ============ Player Management ============

  addPlayer(playerId: string): void {
    this.players.add(playerId);
    this.latencyProfiles.set(playerId, {
      playerId,
      samples: [],
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      jitter: 0,
    });
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.pendingActions.delete(playerId);
    this.commitments.delete(playerId);
    this.latencyProfiles.delete(playerId);
  }

  // ============ Turn Management ============

  /**
   * Start a new turn
   */
  startTurn(): void {
    this.currentTurn++;
    this.turnStartTime = Date.now();
    this.pendingActions.clear();
    this.commitments.clear();
  }

  /**
   * Get deadline for current turn (adjusted per player if needed)
   */
  getDeadline(playerId?: string): number {
    let deadline = this.turnStartTime + this.config.turnTimeout;

    if (playerId && this.config.networkCompensation) {
      const profile = this.latencyProfiles.get(playerId);
      if (profile) {
        const adjustment = Math.min(profile.averageLatency, this.config.maxLatencyAllowance);
        deadline += adjustment;
      }
    }

    return deadline;
  }

  /**
   * Check if turn has timed out
   */
  isTimedOut(): boolean {
    return Date.now() > this.turnStartTime + this.config.turnTimeout;
  }

  /**
   * Get time remaining in current turn
   */
  getTimeRemaining(): number {
    return Math.max(0, this.getDeadline() - Date.now());
  }

  // ============ Action Submission ============

  /**
   * Submit an action for a player
   */
  submitAction(playerId: string, action: Action, clientTimestamp?: number): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }

    const now = Date.now();

    // Check if within deadline (with latency compensation)
    const deadline = this.getDeadline(playerId);
    if (now > deadline) {
      return false;
    }

    // L-I4: Use only server timestamp for ordering; client timestamps are untrusted
    const pending: PendingAction = {
      playerId,
      action,
      clientTimestamp: now,
      serverTimestamp: now,
      adjustedTimestamp: now,
    };

    this.pendingActions.set(playerId, pending);
    return true;
  }

  /**
   * Submit a commitment hash (for simultaneous reveal mode)
   */
  submitCommitment(playerId: string, hash: string): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }

    if (Date.now() > this.getDeadline(playerId)) {
      return false;
    }

    this.commitments.set(playerId, hash);
    return true;
  }

  /**
   * Reveal action after commitment (for simultaneous mode)
   */
  revealAction(playerId: string, action: Action, nonce: string): boolean {
    const commitment = this.commitments.get(playerId);
    if (!commitment) {
      return false;
    }

    // Verify commitment matches
    const expectedHash = this.hashAction(action, nonce);
    if (commitment !== expectedHash) {
      return false;
    }

    return this.submitAction(playerId, action);
  }

  // ============ Turn Resolution ============

  /**
   * Collect all actions and resolve the turn
   */
  async collectTurn(): Promise<TurnResult> {
    // Wait for deadline or all players to submit
    await this.waitForTurn();

    const actions = new Map<string, Action>();
    const timedOut: string[] = [];

    for (const playerId of this.players) {
      const pending = this.pendingActions.get(playerId);
      if (pending) {
        actions.set(playerId, pending.action);
      } else {
        timedOut.push(playerId);
      }
    }

    const duration = Date.now() - this.turnStartTime;

    return { actions, timedOut, duration };
  }

  /**
   * Collect simultaneous actions with commit-reveal
   */
  async collectSimultaneous(): Promise<TurnResult> {
    // Phase 1: Wait for all commitments
    await this.waitForCommitments();

    // Phase 2: Wait for all reveals
    await this.waitForTurn();

    return this.collectTurn();
  }

  private async waitForTurn(): Promise<void> {
    const checkInterval = 10; // ms

    while (true) {
      // All players submitted
      if (this.pendingActions.size >= this.players.size) {
        break;
      }

      // Timeout reached
      if (this.isTimedOut()) {
        break;
      }

      await this.sleep(checkInterval);
    }
  }

  private async waitForCommitments(): Promise<void> {
    const commitmentDeadline = this.turnStartTime + this.config.turnTimeout / 2;

    while (Date.now() < commitmentDeadline) {
      if (this.commitments.size >= this.players.size) {
        break;
      }
      await this.sleep(10);
    }
  }

  // ============ Latency Tracking ============

  /**
   * Record a latency sample for a player
   */
  recordLatency(playerId: string, latency: number): void {
    const profile = this.latencyProfiles.get(playerId);
    if (!profile) return;

    profile.samples.push(latency);

    // Keep last 20 samples
    if (profile.samples.length > 20) {
      profile.samples.shift();
    }

    // Update statistics
    const samples = profile.samples;
    profile.averageLatency = samples.reduce((a, b) => a + b, 0) / samples.length;
    profile.minLatency = Math.min(...samples);
    profile.maxLatency = Math.max(...samples);
    profile.jitter = profile.maxLatency - profile.minLatency;
  }

  /**
   * Get latency profile for a player
   */
  getLatencyProfile(playerId: string): LatencyProfile | undefined {
    return this.latencyProfiles.get(playerId);
  }

  // ============ Helpers ============

  private hashAction(action: Action, nonce: string): string {
    const data = JSON.stringify({ action, nonce });
    return createHash('sha256').update(data).digest('hex');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ State ============

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getConfig(): TurnSchedulerConfig {
    return { ...this.config };
  }

  getPlayers(): string[] {
    return Array.from(this.players);
  }

  hasPendingAction(playerId: string): boolean {
    return this.pendingActions.has(playerId);
  }
}
