/**
 * WASM Sandbox
 *
 * Provides a secure sandboxed execution environment for user-created WASM games.
 * Enforces memory limits, CPU time budgets, and API access restrictions.
 */

// =============================================================================
// Constants
// =============================================================================

import { randomInt } from 'crypto';

/** Size of a single WebAssembly memory page in bytes (64 KB). */
const WASM_PAGE_BYTES = 65_536;

/**
 * Mulberry32 seeded PRNG. Deterministic given the same seed,
 * enabling game replay capability.
 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Required WASM exports on the server side.
 * Note: `render` is client-only and intentionally excluded here.
 */
const REQUIRED_SERVER_EXPORTS: readonly string[] = [
  'init',
  'update',
  'handleInput',
  'getState',
] as const;

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

  /** Seed used for the PRNG (enables replay) */
  seed: number;

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
 * WasmSandbox: Secure execution environment for WASM game modules.
 *
 * Validates, loads, and runs WASM modules with resource constraints
 * including memory limits and per-call CPU time budgets.
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
   *
   * Creates a bounded WebAssembly.Memory, injects host function imports that
   * mirror the client-side runtime, validates that all required server exports
   * are present, and wraps every call() with a CPU time budget check.
   */
  async loadGame(wasmBytes: Uint8Array, gameType: string): Promise<GameInstance> {
    const validation = await this.validateModule(wasmBytes);
    if (!validation.valid) {
      throw new Error(`Invalid WASM module: ${validation.errors.join(', ')}`);
    }

    // -----------------------------------------------------------------------
    // Memory limits: cap the linear memory the module is allowed to grow to.
    // initial = 1 page (64 KB), maximum = maxMemory converted to pages.
    // -----------------------------------------------------------------------
    const maxPages = Math.max(1, Math.floor(this.config.maxMemory / WASM_PAGE_BYTES));
    const memory = new WebAssembly.Memory({ initial: 1, maximum: maxPages });

    // -----------------------------------------------------------------------
    // Host function imports (matches the client-side runtime in wasm-runtime.ts).
    // On the server, canvas dimensions return fixed values and console_log is
    // a debug-gated no-op.
    // -----------------------------------------------------------------------
    const debug = this.config.debug;

    // M13: Use a seeded PRNG so game runs are deterministic and replayable.
    // Generate a cryptographically random seed per session.
    const seed = randomInt(0, 0xffffffff);
    const seededRng = mulberry32(seed);

    const imports: WebAssembly.Imports = {
      env: {
        memory,
        canvas_width: () => 960,
        canvas_height: () => 540,
        console_log: (_ptr: number, _len: number) => {
          if (debug) {
            // Server-side: log pointer and length when debug is enabled.
            // Full string decoding would require reading from the memory buffer.
            console.log('[WasmSandbox]', _ptr, _len);
          }
        },
        math_random: () => seededRng(),
        performance_now: () => performance.now(),
      },
    };

    const module = await WebAssembly.compile(wasmBytes as BufferSource);
    const instance = await WebAssembly.instantiate(module, imports);

    // -----------------------------------------------------------------------
    // Validate required exports.
    // The server only needs init, update, handleInput, and getState.
    // render is client-only and intentionally not required here.
    // -----------------------------------------------------------------------
    const missing: string[] = [];
    for (const name of REQUIRED_SERVER_EXPORTS) {
      if (typeof instance.exports[name] !== 'function') {
        missing.push(name);
      }
    }
    if (missing.length > 0) {
      throw new Error(`WASM module is missing required exports: ${missing.join(', ')}`);
    }

    // -----------------------------------------------------------------------
    // Build the GameInstance with CPU time enforcement on call().
    // -----------------------------------------------------------------------
    const maxTickTime = this.config.maxTickTime;
    const instancesMap = this.instances;
    const id = `${gameType}_${Date.now()}`;

    // Keep a mutable reference so destroy() can null it out.
    let wasmInstance: WebAssembly.Instance | null = instance;

    const gameInstance: GameInstance = {
      id,
      gameType,
      seed,

      call(funcName: string, ...args: unknown[]): unknown {
        if (!wasmInstance) {
          throw new Error('GameInstance has been destroyed');
        }

        const fn = (wasmInstance.exports as Record<string, (...a: unknown[]) => unknown>)[funcName];
        if (typeof fn !== 'function') {
          throw new Error(`Export "${funcName}" is not a function`);
        }

        // CPU time enforcement via performance.now() bracketing.
        // NOTE: This is a post-hoc check, not true preemption. A malicious
        // module could still block the thread for up to one full call.
        // True preemption requires running the WASM in a Worker thread and
        // terminating it on timeout (future work).
        const start = performance.now();
        const result = fn(...args);
        const elapsed = performance.now() - start;

        if (elapsed > maxTickTime) {
          throw new Error(
            `WASM call "${funcName}" exceeded CPU budget: ` +
              `${elapsed.toFixed(2)}ms > ${maxTickTime}ms limit`,
          );
        }

        return result;
      },

      destroy() {
        // Release the WASM instance reference and remove from the map.
        wasmInstance = null;
        instancesMap.delete(id);
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
