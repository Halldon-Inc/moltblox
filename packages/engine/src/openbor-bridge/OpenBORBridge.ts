import {
  FighterState,
  BotInput,
  BotObservation,
  ArenaMatchState,
  MatchPhase,
  ValidActions,
  ArenaGameConfig,
} from '@moltblox/protocol';

// =============================================================================
// OpenBOR Bridge Configuration
// =============================================================================

export interface OpenBORConfig {
  canvasId: string;
  wasmPath: string;
  gamePakPath: string;
  onStateUpdate?: (state: ArenaMatchState) => void;
  onMatchEnd?: (winnerId: string) => void;
  onRoundEnd?: (roundNumber: number, winnerId: string) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// OpenBOR Memory Interface
// Defines how we read from/write to the WASM memory
// =============================================================================

interface OpenBORMemoryLayout {
  // Player 1 state offsets
  p1HealthOffset: number;
  p1XOffset: number;
  p1YOffset: number;
  p1StateOffset: number;
  p1FacingOffset: number;
  p1GroundedOffset: number;
  p1MagicOffset: number;
  p1VxOffset: number;
  p1VyOffset: number;

  // Player 2 state offsets (same structure, different base)
  p2HealthOffset: number;
  p2XOffset: number;
  p2YOffset: number;
  p2StateOffset: number;
  p2FacingOffset: number;
  p2GroundedOffset: number;
  p2MagicOffset: number;
  p2VxOffset: number;
  p2VyOffset: number;

  // Match state offsets
  roundNumberOffset: number;
  roundsP1Offset: number;
  roundsP2Offset: number;
  timeRemainingOffset: number;
  matchPhaseOffset: number;

  // Input buffer offsets
  p1InputOffset: number;
  p2InputOffset: number;
}

// Default memory layout (will be adjusted based on actual OpenBOR-WASM build)
const DEFAULT_MEMORY_LAYOUT: OpenBORMemoryLayout = {
  p1HealthOffset: 0x1000,
  p1XOffset: 0x1004,
  p1YOffset: 0x1008,
  p1StateOffset: 0x100c,
  p1FacingOffset: 0x1010,
  p1GroundedOffset: 0x1014,
  p1MagicOffset: 0x1018,
  p1VxOffset: 0x101c,
  p1VyOffset: 0x1020,

  p2HealthOffset: 0x1100,
  p2XOffset: 0x1104,
  p2YOffset: 0x1108,
  p2StateOffset: 0x110c,
  p2FacingOffset: 0x1110,
  p2GroundedOffset: 0x1114,
  p2MagicOffset: 0x1118,
  p2VxOffset: 0x111c,
  p2VyOffset: 0x1120,

  roundNumberOffset: 0x2000,
  roundsP1Offset: 0x2004,
  roundsP2Offset: 0x2008,
  timeRemainingOffset: 0x200c,
  matchPhaseOffset: 0x2010,

  p1InputOffset: 0x3000,
  p2InputOffset: 0x3010,
};

// =============================================================================
// State Mapping
// =============================================================================

const STATE_MAP: Record<number, FighterState['state']> = {
  0: 'idle',
  1: 'walking',
  2: 'running',
  3: 'jumping',
  4: 'falling',
  5: 'attacking',
  6: 'blocking',
  7: 'hitstun',
  8: 'knockdown',
  9: 'getting_up',
  10: 'ko',
};

const PHASE_MAP: Record<number, MatchPhase> = {
  0: 'countdown',
  1: 'fighting',
  2: 'round_end',
  3: 'ko',
  4: 'timeout',
  5: 'match_end',
};

// =============================================================================
// OpenBOR Bridge Class
// =============================================================================

export class OpenBORBridge {
  private config: OpenBORConfig;
  private wasmInstance: WebAssembly.Instance | null = null;
  private wasmMemory: WebAssembly.Memory | null = null;
  private memoryView: DataView | null = null;
  private memoryLayout: OpenBORMemoryLayout = DEFAULT_MEMORY_LAYOUT;
  private isRunning: boolean = false;
  private frameNumber: number = 0;
  private matchId: string = '';
  private player1BotId: string = '';
  private player2BotId: string = '';
  private gameConfig: ArenaGameConfig;

  constructor(config: OpenBORConfig) {
    this.config = config;
    this.gameConfig = {
      gameType: 'beat_em_up',
      maxPlayers: 2,
      turnBased: false,
      turnTimeout: 100,
      roundsToWin: 2,
      roundTimeSeconds: 99,
      startingHealth: 1000,
      startingMagic: 0,
      magicGainPerHit: 5,
      tickRate: 60,
      decisionTimeoutMs: 100,
      stageWidth: 1920,
      stageHeight: 1080,
    };
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  async initialize(): Promise<void> {
    try {
      // Load WASM module
      const response = await fetch(this.config.wasmPath);
      if (!response.ok) {
        throw new Error(`Failed to load WASM: ${response.statusText}`);
      }

      const wasmBuffer = await response.arrayBuffer();

      // Create memory
      this.wasmMemory = new WebAssembly.Memory({
        initial: 256,
        maximum: 512,
        shared: true,
      });

      // Compile and instantiate
      const wasmModule = await WebAssembly.compile(wasmBuffer);
      this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
        env: {
          memory: this.wasmMemory,
          // Provide required imports for OpenBOR
          _emscripten_notify_memory_growth: () => this.updateMemoryView(),
          emscripten_resize_heap: () => {},
          __assert_fail: () => {},
        },
        wasi_snapshot_preview1: {
          // WASI stubs — OpenBOR renders to canvas and reads game paks via fetch,
          // so it does not need real filesystem or process lifecycle support.
          // Return 0 (WASI errno success) for fd operations.
          proc_exit: () => {},
          fd_close: () => 0,
          fd_write: () => 0,
          fd_seek: () => 0,
          fd_read: () => 0,
          fd_fdstat_get: () => 0,
          fd_prestat_get: () => 8, // errno 8 = EBADF (no preopens available)
          fd_prestat_dir_name: () => 8,
        },
      });

      this.updateMemoryView();

      console.log('OpenBOR WASM initialized successfully');
    } catch (error) {
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  private updateMemoryView(): void {
    if (this.wasmMemory) {
      this.memoryView = new DataView(this.wasmMemory.buffer);
    }
  }

  // ===========================================================================
  // State Extraction
  // ===========================================================================

  /**
   * Extract current fighter state from WASM memory
   */
  private extractFighterState(playerId: 1 | 2): FighterState {
    if (!this.memoryView) {
      return this.getDefaultFighterState(playerId);
    }

    const offsets =
      playerId === 1
        ? {
            health: this.memoryLayout.p1HealthOffset,
            x: this.memoryLayout.p1XOffset,
            y: this.memoryLayout.p1YOffset,
            state: this.memoryLayout.p1StateOffset,
            facing: this.memoryLayout.p1FacingOffset,
            grounded: this.memoryLayout.p1GroundedOffset,
            magic: this.memoryLayout.p1MagicOffset,
            vx: this.memoryLayout.p1VxOffset,
            vy: this.memoryLayout.p1VyOffset,
          }
        : {
            health: this.memoryLayout.p2HealthOffset,
            x: this.memoryLayout.p2XOffset,
            y: this.memoryLayout.p2YOffset,
            state: this.memoryLayout.p2StateOffset,
            facing: this.memoryLayout.p2FacingOffset,
            grounded: this.memoryLayout.p2GroundedOffset,
            magic: this.memoryLayout.p2MagicOffset,
            vx: this.memoryLayout.p2VxOffset,
            vy: this.memoryLayout.p2VyOffset,
          };

    const stateCode = this.memoryView.getInt32(offsets.state, true);
    const state = STATE_MAP[stateCode] || 'idle';
    const canAct = ['idle', 'walking', 'running', 'jumping', 'falling'].includes(state);

    return {
      health: this.memoryView.getInt32(offsets.health, true),
      maxHealth: this.gameConfig.startingHealth,
      magic: this.memoryView.getInt32(offsets.magic, true),
      maxMagic: 100,
      x: this.memoryView.getFloat32(offsets.x, true),
      y: this.memoryView.getFloat32(offsets.y, true),
      vx: this.memoryView.getFloat32(offsets.vx, true),
      vy: this.memoryView.getFloat32(offsets.vy, true),
      facing: this.memoryView.getInt32(offsets.facing, true) > 0 ? 'right' : 'left',
      state,
      grounded: this.memoryView.getInt32(offsets.grounded, true) !== 0,
      canAct,
      comboCounter: 0,
      lastAttackFrame: 0,
    };
  }

  private getDefaultFighterState(playerId: 1 | 2): FighterState {
    return {
      health: this.gameConfig.startingHealth,
      maxHealth: this.gameConfig.startingHealth,
      magic: 0,
      maxMagic: 100,
      x: playerId === 1 ? 200 : 1720,
      y: 400,
      vx: 0,
      vy: 0,
      facing: playerId === 1 ? 'right' : 'left',
      state: 'idle',
      grounded: true,
      canAct: true,
      comboCounter: 0,
      lastAttackFrame: 0,
    };
  }

  /**
   * Get current match state
   */
  getMatchState(): ArenaMatchState {
    const player1 = this.extractFighterState(1);
    const player2 = this.extractFighterState(2);

    let roundNumber = 1;
    let roundsP1 = 0;
    let roundsP2 = 0;
    let timeRemaining = this.gameConfig.roundTimeSeconds;
    let phase: MatchPhase = 'countdown';

    if (this.memoryView) {
      roundNumber = this.memoryView.getInt32(this.memoryLayout.roundNumberOffset, true);
      roundsP1 = this.memoryView.getInt32(this.memoryLayout.roundsP1Offset, true);
      roundsP2 = this.memoryView.getInt32(this.memoryLayout.roundsP2Offset, true);
      timeRemaining = this.memoryView.getInt32(this.memoryLayout.timeRemainingOffset, true);
      const phaseCode = this.memoryView.getInt32(this.memoryLayout.matchPhaseOffset, true);
      phase = PHASE_MAP[phaseCode] || 'countdown';
    }

    // Determine winner if match ended
    let winner: string | null = null;
    if (phase === 'match_end') {
      winner = roundsP1 >= this.gameConfig.roundsToWin ? this.player1BotId : this.player2BotId;
    }

    return {
      matchId: this.matchId,
      player1,
      player2,
      player1BotId: this.player1BotId,
      player2BotId: this.player2BotId,
      roundNumber,
      roundsP1,
      roundsP2,
      timeRemaining,
      phase,
      frameNumber: this.frameNumber,
      winner,
    };
  }

  /**
   * Generate observation for a specific bot
   */
  generateObservation(botId: string): BotObservation {
    const state = this.getMatchState();
    const isPlayer1 = botId === this.player1BotId;

    const self = isPlayer1 ? state.player1 : state.player2;
    const opponent = isPlayer1 ? state.player2 : state.player1;

    const distance = Math.sqrt(Math.pow(opponent.x - self.x, 2) + Math.pow(opponent.y - self.y, 2));
    const horizontalDistance = Math.abs(opponent.x - self.x);
    const verticalDistance = Math.abs(opponent.y - self.y);

    // Determine valid actions based on state
    const validActions: ValidActions = [];
    if (self.canAct) {
      validActions.push('MOVE_LEFT', 'MOVE_RIGHT', 'WAIT');
      if (self.grounded) {
        validActions.push('JUMP', 'BLOCK');
      }
      validActions.push('ATTACK_LIGHT', 'ATTACK_HEAVY');
      if (self.magic >= 25) {
        validActions.push('SPECIAL');
      }
    }

    return {
      self: {
        health: self.health,
        healthPercent: self.health / self.maxHealth,
        magic: self.magic,
        magicPercent: self.magic / self.maxMagic,
        position: { x: self.x, y: self.y },
        velocity: { vx: self.vx, vy: self.vy },
        state: self.state,
        facing: self.facing,
        grounded: self.grounded,
        canAct: self.canAct,
        comboCounter: self.comboCounter,
      },
      opponent: {
        health: opponent.health,
        healthPercent: opponent.health / opponent.maxHealth,
        position: { x: opponent.x, y: opponent.y },
        state: opponent.state,
        facing: opponent.facing,
        isAttacking: opponent.state === 'attacking',
        isBlocking: opponent.state === 'blocking',
        isVulnerable: ['hitstun', 'knockdown', 'getting_up'].includes(opponent.state),
        grounded: opponent.grounded,
      },
      distance,
      horizontalDistance,
      verticalDistance,
      inAttackRange: horizontalDistance < 150 && verticalDistance < 50,
      inSpecialRange: horizontalDistance < 300,
      roundNumber: state.roundNumber,
      roundsWon: isPlayer1 ? state.roundsP1 : state.roundsP2,
      roundsLost: isPlayer1 ? state.roundsP2 : state.roundsP1,
      timeRemaining: state.timeRemaining,
      frameNumber: this.frameNumber,
      decisionDeadlineMs: this.gameConfig.decisionTimeoutMs,
      validActions,
    };
  }

  // ===========================================================================
  // Input Injection
  // ===========================================================================

  /**
   * Set player input for next frame
   */
  setPlayerInput(playerId: 1 | 2, input: BotInput): void {
    if (!this.memoryView) {
      return;
    }

    const offset =
      playerId === 1 ? this.memoryLayout.p1InputOffset : this.memoryLayout.p2InputOffset;

    // Pack input into bitfield
    let inputBits = 0;
    if (input.left) inputBits |= 1 << 0;
    if (input.right) inputBits |= 1 << 1;
    if (input.up) inputBits |= 1 << 2;
    if (input.down) inputBits |= 1 << 3;
    if (input.attack1) inputBits |= 1 << 4;
    if (input.attack2) inputBits |= 1 << 5;
    if (input.jump) inputBits |= 1 << 6;
    if (input.special) inputBits |= 1 << 7;

    this.memoryView.setInt32(offset, inputBits, true);
  }

  /**
   * Set input for a bot by their ID
   */
  setBotInput(botId: string, input: BotInput): void {
    const playerId = botId === this.player1BotId ? 1 : 2;
    this.setPlayerInput(playerId, input);
  }

  // ===========================================================================
  // Match Control
  // ===========================================================================

  /**
   * Start a new match
   */
  startMatch(matchId: string, player1BotId: string, player2BotId: string): void {
    this.matchId = matchId;
    this.player1BotId = player1BotId;
    this.player2BotId = player2BotId;
    this.frameNumber = 0;
    this.isRunning = true;

    // Call OpenBOR start function if available
    if (this.wasmInstance) {
      const startFn = this.wasmInstance.exports.startMatch as
        | ((...args: unknown[]) => unknown)
        | undefined;
      startFn?.();
    }
  }

  /**
   * Pause the match
   */
  pauseMatch(): void {
    this.isRunning = false;
    if (this.wasmInstance) {
      const pauseFn = this.wasmInstance.exports.pauseMatch as
        | ((...args: unknown[]) => unknown)
        | undefined;
      pauseFn?.();
    }
  }

  /**
   * Resume the match
   */
  resumeMatch(): void {
    this.isRunning = true;
    if (this.wasmInstance) {
      const resumeFn = this.wasmInstance.exports.resumeMatch as
        | ((...args: unknown[]) => unknown)
        | undefined;
      resumeFn?.();
    }
  }

  /**
   * Reset the match to initial state
   */
  resetMatch(): void {
    this.frameNumber = 0;
    if (this.wasmInstance) {
      const resetFn = this.wasmInstance.exports.resetMatch as
        | ((...args: unknown[]) => unknown)
        | undefined;
      resetFn?.();
    }
  }

  /**
   * Advance one frame
   */
  tick(): ArenaMatchState {
    if (!this.isRunning) {
      return this.getMatchState();
    }

    // Call OpenBOR tick function
    if (this.wasmInstance) {
      const tickFn = this.wasmInstance.exports.tick as
        | ((...args: unknown[]) => unknown)
        | undefined;
      tickFn?.();
    }

    this.frameNumber++;

    const state = this.getMatchState();

    // Emit state update
    this.config.onStateUpdate?.(state);

    // Check for round/match end
    if (state.phase === 'round_end' || state.phase === 'ko') {
      const roundWinner = state.roundsP1 > state.roundsP2 ? this.player1BotId : this.player2BotId;
      this.config.onRoundEnd?.(state.roundNumber, roundWinner);
    }

    if (state.phase === 'match_end' && state.winner) {
      this.config.onMatchEnd?.(state.winner);
      this.isRunning = false;
    }

    return state;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  isMatchRunning(): boolean {
    return this.isRunning;
  }

  getFrameNumber(): number {
    return this.frameNumber;
  }

  getGameConfig(): ArenaGameConfig {
    return { ...this.gameConfig };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.isRunning = false;
    this.wasmInstance = null;
    this.wasmMemory = null;
    this.memoryView = null;
  }
}
