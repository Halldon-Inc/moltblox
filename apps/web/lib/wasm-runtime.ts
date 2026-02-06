/**
 * WASM Game Runtime Types & Loader
 *
 * Defines the standard interface that all WASM game bundles must export,
 * and provides the runtime loader that fetches, instantiates, and manages
 * the game loop lifecycle.
 */

// ─── Game API types ────────────────────────────────────────────────────────

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  targetFps: number;
  playerCount: number;
  seed?: number;
  [key: string]: unknown;
}

export interface GameInput {
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove';
  key?: string;
  code?: string;
  x?: number;
  y?: number;
  button?: number;
}

export interface GameState {
  phase: 'loading' | 'running' | 'paused' | 'ended';
  score: number;
  tick: number;
  data: Record<string, unknown>;
}

/**
 * The standard interface that every WASM game module must export.
 * The WASM bundle is expected to expose these functions through its exports.
 */
export interface WasmGameExports {
  init(canvas: HTMLCanvasElement, config: GameConfig): void;
  update(deltaTime: number): void;
  render(): void;
  handleInput(event: GameInput): void;
  getState(): GameState;
  destroy(): void;
}

// ─── Runtime states ────────────────────────────────────────────────────────

export type RuntimeStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'running'
  | 'paused'
  | 'error'
  | 'destroyed';

export interface RuntimeState {
  status: RuntimeStatus;
  error: string | null;
  fps: number;
  frameCount: number;
}

// ─── WASM Game Runtime ─────────────────────────────────────────────────────

export class WasmGameRuntime {
  private module: WasmGameExports | null = null;
  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private fpsFrames: number = 0;
  private currentFps: number = 0;
  private _status: RuntimeStatus = 'idle';
  private onStateChange: ((state: RuntimeState) => void) | null = null;

  get status(): RuntimeStatus {
    return this._status;
  }

  getState(): RuntimeState {
    return {
      status: this._status,
      error: null,
      fps: this.currentFps,
      frameCount: this.frameCount,
    };
  }

  setOnStateChange(cb: (state: RuntimeState) => void): void {
    this.onStateChange = cb;
  }

  private emitState(error?: string): void {
    this.onStateChange?.({
      status: this._status,
      error: error ?? null,
      fps: this.currentFps,
      frameCount: this.frameCount,
    });
  }

  /**
   * Fetch and instantiate a WASM module from the given URL.
   * Falls back gracefully if the module can't be loaded.
   */
  async load(wasmUrl: string, canvas: HTMLCanvasElement, config: GameConfig): Promise<void> {
    this._status = 'loading';
    this.emitState();

    try {
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM bundle: ${response.status} ${response.statusText}`);
      }

      const wasmBuffer = await response.arrayBuffer();

      // Create the import object the WASM module needs
      const importObject = {
        env: {
          // Canvas drawing bridge functions that the WASM can call
          canvas_width: () => canvas.width,
          canvas_height: () => canvas.height,
          console_log: (ptr: number, len: number) => {
            // WASM string logging helper
            if (this.module) {
              console.log('[WASM]', ptr, len);
            }
          },
          math_random: () => Math.random(),
          performance_now: () => performance.now(),
        },
      };

      const { instance } = await WebAssembly.instantiate(wasmBuffer, importObject);
      const exports = instance.exports as unknown as WasmGameExports;

      // Validate that the module exports the required functions
      const required: (keyof WasmGameExports)[] = [
        'init',
        'update',
        'render',
        'handleInput',
        'getState',
        'destroy',
      ];
      for (const fn of required) {
        if (typeof exports[fn] !== 'function') {
          throw new Error(`WASM module missing required export: ${fn}`);
        }
      }

      this.module = exports;
      this.module.init(canvas, config);
      this._status = 'ready';
      this.emitState();
    } catch (err) {
      this._status = 'error';
      const message = err instanceof Error ? err.message : 'Unknown error loading WASM';
      this.emitState(message);
      throw err;
    }
  }

  /** Start the game loop. */
  start(): void {
    if (!this.module || this._status === 'running') return;
    this._status = 'running';
    this.lastTimestamp = performance.now();
    this.emitState();
    this.loop(this.lastTimestamp);
  }

  /** Pause the game loop. */
  pause(): void {
    if (this._status !== 'running') return;
    this._status = 'paused';
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.emitState();
  }

  /** Resume after pause. */
  resume(): void {
    if (this._status !== 'paused') return;
    this._status = 'running';
    this.lastTimestamp = performance.now();
    this.emitState();
    this.loop(this.lastTimestamp);
  }

  /** Forward an input event to the WASM module. */
  sendInput(input: GameInput): void {
    if (this.module && this._status === 'running') {
      this.module.handleInput(input);
    }
  }

  /** Get the current game state from the WASM module. */
  getGameState(): GameState | null {
    if (!this.module) return null;
    return this.module.getState();
  }

  /** Tear down everything. */
  destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.module) {
      try {
        this.module.destroy();
      } catch {
        // Ignore errors during cleanup
      }
      this.module = null;
    }
    this._status = 'destroyed';
    this.emitState();
  }

  private loop = (timestamp: number): void => {
    if (this._status !== 'running' || !this.module) return;

    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // FPS calculation
    this.fpsAccumulator += deltaTime;
    this.fpsFrames++;
    if (this.fpsAccumulator >= 1000) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / this.fpsAccumulator);
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }

    this.module.update(deltaTime);
    this.module.render();
    this.frameCount++;

    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
