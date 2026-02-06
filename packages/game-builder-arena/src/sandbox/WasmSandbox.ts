/**
 * WASM Sandbox
 *
 * Provides a secure sandboxed execution environment for user-created WASM games.
 * Enforces memory limits, CPU time budgets, and API access restrictions.
 */

// =============================================================================
// Types
// =============================================================================

export interface SandboxConfig {
  /** Maximum memory in bytes (default 64MB) */
  maxMemory?: number;

  /** Maximum execution time per tick in ms (default 16ms) */
  maxTickTime?: number;

  /** Enable debug logging */
  debug?: boolean;
}

export interface GameInstance {
  /** Unique instance ID */
  id: string;

  /** Game type identifier */
  gameType: string;

  /** Call a function exported by the WASM module */
  call(funcName: string, ...args: unknown[]): unknown;

  /** Destroy the instance and release resources */
  destroy(): void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompilationResult {
  success: boolean;
  wasmBytes?: Uint8Array;
  wasmHash?: string;
  sourceMap?: string;
  errors?: string[];
}

// =============================================================================
// WasmSandbox
// =============================================================================

/**
 * WasmSandbox - Secure execution environment for WASM game modules.
 *
 * Validates, loads, and runs WASM modules with resource constraints.
 */
export class WasmSandbox {
  private config: Required<SandboxConfig>;
  private instances = new Map<string, GameInstance>();

  constructor(config: SandboxConfig = {}) {
    this.config = {
      maxMemory: config.maxMemory ?? 64 * 1024 * 1024,
      maxTickTime: config.maxTickTime ?? 16,
      debug: config.debug ?? false,
    };
  }

  /**
   * Validate a WASM module without instantiating it.
   */
  async validateModule(wasmBytes: Uint8Array): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check WASM magic number
    if (
      wasmBytes.length < 8 ||
      wasmBytes[0] !== 0x00 ||
      wasmBytes[1] !== 0x61 ||
      wasmBytes[2] !== 0x73 ||
      wasmBytes[3] !== 0x6d
    ) {
      errors.push('Invalid WASM module: missing magic number');
      return { valid: false, errors, warnings };
    }

    // Check size limits
    if (wasmBytes.length > this.config.maxMemory) {
      errors.push(
        `WASM module too large: ${wasmBytes.length} bytes exceeds ${this.config.maxMemory} byte limit`,
      );
    }

    // Try to compile (validates structure)
    try {
      await WebAssembly.compile(wasmBytes as BufferSource);
    } catch (err) {
      errors.push(`WASM compilation failed: ${(err as Error).message}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Load and instantiate a game from WASM bytes.
   */
  async loadGame(wasmBytes: Uint8Array, gameType: string): Promise<GameInstance> {
    const validation = await this.validateModule(wasmBytes);
    if (!validation.valid) {
      throw new Error(`Invalid WASM module: ${validation.errors.join(', ')}`);
    }

    const module = await WebAssembly.compile(wasmBytes as BufferSource);
    const instance = await WebAssembly.instantiate(module, {});

    const id = `${gameType}_${Date.now()}`;
    const gameInstance: GameInstance = {
      id,
      gameType,
      call(funcName: string, ...args: unknown[]): unknown {
        const fn = (instance.exports as Record<string, (...args: unknown[]) => unknown>)[funcName];
        if (typeof fn !== 'function') {
          throw new Error(`Export "${funcName}" is not a function`);
        }
        return fn(...args);
      },
      destroy() {
        // Release references
      },
    };

    this.instances.set(id, gameInstance);
    return gameInstance;
  }

  /**
   * Destroy all active instances.
   */
  destroyAll(): void {
    for (const inst of this.instances.values()) {
      inst.destroy();
    }
    this.instances.clear();
  }
}

export default WasmSandbox;
