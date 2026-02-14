/**
 * OpenBOR Adapter
 *
 * Wraps the OpenBORBridge (WASM engine) as a BaseGame, allowing the
 * real-time fighting engine to be managed through the same lifecycle
 * interface used by all Moltblox games.
 *
 * Key design: processAction() only buffers inputs. The actual WASM
 * execution happens in tick(), which is driven externally by the
 * RealTimeSessionManager at 60 fps.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult, GameState } from '@moltblox/protocol';

// =========================================================================
// Configuration
// =========================================================================

export interface OpenBORAdapterConfig {
  fightStyle?: 'beat-em-up' | '1v1' | 'arena';
  roundsToWin?: number;
  roundTime?: number;
  tickRate?: number; // default 60
  startingHealth?: number;
  engine?: 'turn-based' | 'openbor';
}

// =========================================================================
// Input mapping: named actions to OpenBOR input bitfield
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
// State snapshot returned by tick()
// =========================================================================

export interface TickSnapshot {
  frame: number;
  fighters: Record<string, FighterSnapshot>;
  matchState: MatchStateSnapshot;
}

export interface FighterSnapshot {
  health: number;
  maxHealth: number;
  magic: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  state: string;
  grounded: boolean;
}

export interface MatchStateSnapshot {
  roundNumber: number;
  roundsP1: number;
  roundsP2: number;
  timeRemaining: number;
  phase: string;
  winner: string | null;
}

// =========================================================================
// Bridge interface (subset used by the adapter)
// =========================================================================

export interface OpenBORBridgeLike {
  initialize?(): Promise<void>;
  startMatch(matchId: string, player1BotId: string, player2BotId: string): void;
  setPlayerInput(playerId: 1 | 2, input: { [key: string]: boolean | undefined }): void;
  tick(): {
    phase: string;
    winner: string | null;
    frameNumber: number;
    player1: FighterSnapshot;
    player2: FighterSnapshot;
    roundNumber: number;
    roundsP1: number;
    roundsP2: number;
    timeRemaining: number;
    matchId: string;
    player1BotId: string;
    player2BotId: string;
  };
  getMatchState(): {
    phase: string;
    winner: string | null;
    frameNumber: number;
    player1: FighterSnapshot;
    player2: FighterSnapshot;
    roundNumber: number;
    roundsP1: number;
    roundsP2: number;
    timeRemaining: number;
    matchId: string;
    player1BotId: string;
    player2BotId: string;
  };
  isMatchRunning(): boolean;
  getFrameNumber(): number;
  getGameConfig(): {
    startingHealth: number;
    roundsToWin: number;
    roundTimeSeconds: number;
    tickRate: number;
    [key: string]: unknown;
  };
  dispose(): void;
}

// =========================================================================
// OpenBORAdapter
// =========================================================================

export class OpenBORAdapter extends BaseGame {
  readonly name = 'OpenBOR Fighter';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private bridge: OpenBORBridgeLike | null = null;
  private inputBuffer: Map<string, number> = new Map();
  private frameNumber = 0;
  private playerSlots: Map<string, 1 | 2> = new Map();
  private matchEnded = false;
  private lastMatchState: TickSnapshot | null = null;

  private get adapterConfig(): OpenBORAdapterConfig {
    return this.config as OpenBORAdapterConfig;
  }

  get tickRate(): number {
    return this.adapterConfig.tickRate ?? 60;
  }

  // -----------------------------------------------------------------------
  // Bridge attachment (injected by the session manager)
  // -----------------------------------------------------------------------

  /**
   * Attach an OpenBORBridge instance (or test mock) before initialization.
   */
  setBridge(bridge: OpenBORBridgeLike): void {
    this.bridge = bridge;
  }

  getBridge(): OpenBORBridgeLike | null {
    return this.bridge;
  }

  // -----------------------------------------------------------------------
  // BaseGame overrides
  // -----------------------------------------------------------------------

  protected initializeState(playerIds: string[]): Record<string, unknown> {
    // Map players to P1 / P2 slots
    this.playerSlots.clear();
    this.playerSlots.set(playerIds[0], 1);
    if (playerIds[1]) {
      this.playerSlots.set(playerIds[1], 2);
    }

    this.frameNumber = 0;
    this.matchEnded = false;
    this.inputBuffer.clear();
    this.lastMatchState = null;

    // Tell the bridge to start a match
    if (this.bridge) {
      const matchId = `obor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.bridge.startMatch(matchId, playerIds[0], playerIds[1] ?? 'cpu');
    }

    const startingHealth = this.adapterConfig.startingHealth ?? 1000;

    return {
      engine: 'openbor',
      fightStyle: this.adapterConfig.fightStyle ?? '1v1',
      roundsToWin: this.adapterConfig.roundsToWin ?? 2,
      roundTime: this.adapterConfig.roundTime ?? 99,
      tickRate: this.tickRate,
      startingHealth,
      fighters: Object.fromEntries(
        playerIds.map((pid) => [
          pid,
          {
            health: startingHealth,
            maxHealth: startingHealth,
            magic: 0,
            x: this.playerSlots.get(pid) === 1 ? 200 : 1720,
            y: 400,
            vx: 0,
            vy: 0,
            facing: this.playerSlots.get(pid) === 1 ? 'right' : 'left',
            state: 'idle',
            grounded: true,
            roundWins: 0,
          },
        ]),
      ),
      roundNumber: 1,
      timeRemaining: this.adapterConfig.roundTime ?? 99,
      phase: 'countdown',
      winner: null,
    };
  }

  /**
   * Buffer a player's input. The action payload may contain either:
   *   - { input: number }          (raw bitfield)
   *   - { input: 'move_left' }     (named action, mapped to bitfield)
   *   - { input: 'attack1|jump' }  (combined named actions, pipe-delimited)
   *
   * Inputs are OR-ed together so multiple calls within a single tick
   * accumulate rather than replace.
   */
  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (this.matchEnded) {
      return { success: false, error: 'Match has already ended' };
    }

    const slot = this.playerSlots.get(playerId);
    if (!slot) {
      return { success: false, error: 'Player is not part of this match' };
    }

    const rawInput = action.payload.input;
    let bits = 0;

    if (typeof rawInput === 'number') {
      bits = rawInput & 0xff;
    } else if (typeof rawInput === 'string') {
      // Support pipe-delimited combined actions: "move_left|attack1"
      const names = rawInput.split('|');
      for (const name of names) {
        const trimmed = name.trim();
        if (INPUT_MAP[trimmed] !== undefined) {
          bits |= INPUT_MAP[trimmed];
        }
      }
    }

    // Accumulate (OR) with any existing buffered input for this player
    const existing = this.inputBuffer.get(playerId) ?? 0;
    this.inputBuffer.set(playerId, existing | bits);

    return { success: true, newState: this.getState() };
  }

  // -----------------------------------------------------------------------
  // Tick (called externally by RealTimeSessionManager)
  // -----------------------------------------------------------------------

  /**
   * Advance one frame:
   *  1. Flush buffered inputs into the bridge
   *  2. Call bridge.tick()
   *  3. Extract and return the state snapshot
   */
  tick(): TickSnapshot {
    this.frameNumber++;

    // Apply buffered inputs to bridge
    if (this.bridge) {
      for (const [playerId, bits] of this.inputBuffer) {
        const slot = this.playerSlots.get(playerId);
        if (!slot) continue;
        this.bridge.setPlayerInput(slot, {
          left: !!(bits & INPUT_MAP.move_left),
          right: !!(bits & INPUT_MAP.move_right),
          up: !!(bits & INPUT_MAP.move_up),
          down: !!(bits & INPUT_MAP.move_down),
          attack1: !!(bits & INPUT_MAP.attack1),
          attack2: !!(bits & INPUT_MAP.attack2),
          jump: !!(bits & INPUT_MAP.jump),
          special: !!(bits & INPUT_MAP.special),
        });
      }
    }

    // Clear input buffer after applying
    this.inputBuffer.clear();

    // Advance WASM frame
    let bridgeState: ReturnType<OpenBORBridgeLike['tick']> | null = null;
    if (this.bridge) {
      bridgeState = this.bridge.tick();
    }

    // Build snapshot from bridge state or defaults
    const snapshot = this.buildSnapshot(bridgeState);
    this.lastMatchState = snapshot;

    // Sync state.data with latest bridge output
    this.syncStateFromSnapshot(snapshot);

    // Check for match end
    if (snapshot.matchState.phase === 'match_end') {
      this.matchEnded = true;
      this.state.phase = 'ended';
    }

    return snapshot;
  }

  /**
   * Build a TickSnapshot from bridge output, falling back to defaults.
   */
  private buildSnapshot(bridgeState: ReturnType<OpenBORBridgeLike['tick']> | null): TickSnapshot {
    if (!bridgeState) {
      const startingHealth = this.adapterConfig.startingHealth ?? 1000;
      const players = this.getPlayers();
      const fighters: Record<string, FighterSnapshot> = {};
      for (const pid of players) {
        fighters[pid] = {
          health: startingHealth,
          maxHealth: startingHealth,
          magic: 0,
          x: this.playerSlots.get(pid) === 1 ? 200 : 1720,
          y: 400,
          vx: 0,
          vy: 0,
          facing: this.playerSlots.get(pid) === 1 ? 'right' : 'left',
          state: 'idle',
          grounded: true,
        };
      }
      return {
        frame: this.frameNumber,
        fighters,
        matchState: {
          roundNumber: 1,
          roundsP1: 0,
          roundsP2: 0,
          timeRemaining: this.adapterConfig.roundTime ?? 99,
          phase: 'countdown',
          winner: null,
        },
      };
    }

    const players = this.getPlayers();
    const p1Id = players[0];
    const p2Id = players[1] ?? 'cpu';

    return {
      frame: this.frameNumber,
      fighters: {
        [p1Id]: this.extractFighter(bridgeState.player1),
        [p2Id]: this.extractFighter(bridgeState.player2),
      },
      matchState: {
        roundNumber: bridgeState.roundNumber,
        roundsP1: bridgeState.roundsP1,
        roundsP2: bridgeState.roundsP2,
        timeRemaining: bridgeState.timeRemaining,
        phase: bridgeState.phase,
        winner: bridgeState.winner,
      },
    };
  }

  private extractFighter(raw: FighterSnapshot): FighterSnapshot {
    return {
      health: raw.health,
      maxHealth: raw.maxHealth,
      magic: raw.magic,
      x: raw.x,
      y: raw.y,
      vx: raw.vx,
      vy: raw.vy,
      facing: raw.facing,
      state: raw.state,
      grounded: raw.grounded,
    };
  }

  /**
   * Push tick snapshot data back into the GameState so that
   * getState() / getScores() / getWinner() remain consistent.
   */
  private syncStateFromSnapshot(snapshot: TickSnapshot): void {
    const data = this.state.data;
    data.fighters = snapshot.fighters;
    data.phase = snapshot.matchState.phase;
    data.roundNumber = snapshot.matchState.roundNumber;
    data.timeRemaining = snapshot.matchState.timeRemaining;
    data.winner = snapshot.matchState.winner;
    data.roundsP1 = snapshot.matchState.roundsP1;
    data.roundsP2 = snapshot.matchState.roundsP2;
    data.frameNumber = snapshot.frame;
  }

  // -----------------------------------------------------------------------
  // Game-over / winner / score checks
  // -----------------------------------------------------------------------

  protected checkGameOver(): boolean {
    return this.matchEnded;
  }

  protected determineWinner(): string | null {
    if (!this.lastMatchState) return null;
    return this.lastMatchState.matchState.winner;
  }

  protected calculateScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    const players = this.getPlayers();
    if (!this.lastMatchState) {
      for (const pid of players) {
        scores[pid] = 0;
      }
      return scores;
    }

    // Score is round wins
    const ms = this.lastMatchState.matchState;
    if (players[0]) scores[players[0]] = ms.roundsP1;
    if (players[1]) scores[players[1]] = ms.roundsP2;
    return scores;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  getFrameNumber(): number {
    return this.frameNumber;
  }

  getLastSnapshot(): TickSnapshot | null {
    return this.lastMatchState;
  }

  /**
   * Compute the state delta between the previous and current snapshot.
   * Returns only the fields that changed, useful for bandwidth optimization.
   */
  computeDelta(previous: TickSnapshot, current: TickSnapshot): Record<string, unknown>[] {
    const changes: Record<string, unknown>[] = [];

    for (const [pid, fighter] of Object.entries(current.fighters)) {
      const prev = previous.fighters[pid];
      if (!prev) continue;

      const diff: Record<string, unknown> = { playerId: pid };
      let hasDiff = false;

      if (prev.health !== fighter.health) {
        diff.health = fighter.health;
        hasDiff = true;
      }
      if (prev.x !== fighter.x) {
        diff.x = fighter.x;
        hasDiff = true;
      }
      if (prev.y !== fighter.y) {
        diff.y = fighter.y;
        hasDiff = true;
      }
      if (prev.vx !== fighter.vx) {
        diff.vx = fighter.vx;
        hasDiff = true;
      }
      if (prev.vy !== fighter.vy) {
        diff.vy = fighter.vy;
        hasDiff = true;
      }
      if (prev.state !== fighter.state) {
        diff.state = fighter.state;
        hasDiff = true;
      }
      if (prev.facing !== fighter.facing) {
        diff.facing = fighter.facing;
        hasDiff = true;
      }
      if (prev.magic !== fighter.magic) {
        diff.magic = fighter.magic;
        hasDiff = true;
      }
      if (prev.grounded !== fighter.grounded) {
        diff.grounded = fighter.grounded;
        hasDiff = true;
      }

      if (hasDiff) changes.push(diff);
    }

    return changes;
  }

  /**
   * Clean up bridge resources.
   */
  dispose(): void {
    if (this.bridge) {
      this.bridge.dispose();
      this.bridge = null;
    }
    this.inputBuffer.clear();
    this.playerSlots.clear();
    this.lastMatchState = null;
  }
}

// Re-export the input map so consumers can reference named actions
export { INPUT_MAP };
