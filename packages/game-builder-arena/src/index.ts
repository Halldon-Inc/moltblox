/**
 * @moltblox/game-builder-arena
 *
 * WASM sandbox and game compilation for Moltblox.
 * Provides secure execution environment for user-created games.
 */

// =============================================================================
// Sandbox
// =============================================================================

export {
  WasmSandbox,
  type SandboxConfig,
  type GameInstance,
  type ValidationResult,
  type CompilationResult,
} from './sandbox/WasmSandbox.js';

// =============================================================================
// Compiler
// =============================================================================

export {
  GameCompiler,
  type CompilerConfig,
  type StaticAnalysisResult,
  type StaticAnalysisIssue,
  type CodeMetrics,
} from './compiler/GameCompiler.js';

// =============================================================================
// Templates
// =============================================================================

export {
  BaseGame,
  ClickRaceGame,
  type ArenaGameInterface,
  type GameState,
  type PlayerState,
  type Action,
  type ActionResult,
  type Effect,
  type TickResult,
  type GameEvent,
  type GameResult,
  type ValidationResult as ActionValidationResult,
  type SerializedGameState,
} from './templates/GameTemplate.js';

// =============================================================================
// Builder Service
// =============================================================================

import { WasmSandbox } from './sandbox/WasmSandbox.js';
import { GameCompiler } from './compiler/GameCompiler.js';

export interface BuildResult {
  success: boolean;
  gameId?: string;
  wasmHash?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * GameBuilder - High-level API for building and deploying games
 */
export class GameBuilder {
  private sandbox: WasmSandbox;
  private compiler: GameCompiler;

  constructor() {
    this.sandbox = new WasmSandbox();
    this.compiler = new GameCompiler();
  }

  /**
   * Build a game from TypeScript source code
   */
  async build(code: string, gameType: string): Promise<BuildResult> {
    // Analyze code
    const analysis = this.compiler.analyzeCode(code);

    if (!analysis.safe) {
      return {
        success: false,
        errors: analysis.issues.filter((i) => i.severity === 'error').map((i) => i.message),
        warnings: analysis.issues.filter((i) => i.severity === 'warning').map((i) => i.message),
      };
    }

    // Compile to WASM
    const compilation = await this.compiler.compile(code);

    if (!compilation.success || !compilation.wasmBytes) {
      return {
        success: false,
        errors: compilation.errors,
      };
    }

    // Validate WASM
    const validation = await this.sandbox.validateModule(compilation.wasmBytes);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Generate game ID
    const gameId = `${gameType}_${compilation.wasmHash?.substring(0, 8)}`;

    return {
      success: true,
      gameId,
      wasmHash: compilation.wasmHash,
      warnings: [
        ...analysis.issues.filter((i) => i.severity === 'warning').map((i) => i.message),
        ...validation.warnings,
      ],
    };
  }

  /**
   * Load and instantiate a game from WASM bytes
   */
  async loadGame(
    wasmBytes: Uint8Array,
    gameType: string,
  ): Promise<ReturnType<WasmSandbox['loadGame']>> {
    return this.sandbox.loadGame(wasmBytes, gameType);
  }

  /**
   * Get the underlying sandbox instance
   */
  getSandbox(): WasmSandbox {
    return this.sandbox;
  }

  /**
   * Get the underlying compiler instance
   */
  getCompiler(): GameCompiler {
    return this.compiler;
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default GameBuilder;
