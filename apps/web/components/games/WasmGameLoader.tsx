'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  WasmGameRuntime,
  type RuntimeState,
  type GameConfig,
  type GameInput,
} from '@/lib/wasm-runtime';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface WasmGameLoaderProps {
  wasmUrl: string;
  gameName: string;
  config?: Partial<GameConfig>;
  onStateChange?: (state: RuntimeState) => void;
  paused?: boolean;
}

const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 960,
  canvasHeight: 540,
  targetFps: 60,
  playerCount: 1,
};

export default function WasmGameLoader({
  wasmUrl,
  gameName,
  config,
  onStateChange,
  paused = false,
}: WasmGameLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<WasmGameRuntime | null>(null);
  const [state, setState] = useState<RuntimeState>({
    status: 'idle',
    error: null,
    fps: 0,
    frameCount: 0,
  });

  const mergedConfig: GameConfig = { ...DEFAULT_CONFIG, ...config };

  // Handle pause/resume from parent
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (paused && runtime.status === 'running') {
      runtime.pause();
    } else if (!paused && runtime.status === 'paused') {
      runtime.resume();
    }
  }, [paused]);

  // Initialize runtime
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = mergedConfig.canvasWidth;
    canvas.height = mergedConfig.canvasHeight;

    const runtime = new WasmGameRuntime();
    runtimeRef.current = runtime;

    runtime.setOnStateChange((newState) => {
      setState(newState);
      onStateChange?.(newState);
    });

    runtime
      .load(wasmUrl, canvas, mergedConfig)
      .then(() => {
        runtime.start();
      })
      .catch(() => {
        // Error state is already set by the runtime
      });

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, [wasmUrl]);

  // Keyboard input handler
  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const input: GameInput = {
      type: e.type as 'keydown' | 'keyup',
      key: e.key,
      code: e.code,
    };
    runtime.sendInput(input);

    // Prevent default for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }, []);

  // Mouse input handler
  const handleMouseEvent = useCallback((e: MouseEvent) => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const input: GameInput = {
      type: e.type as 'mousedown' | 'mouseup' | 'mousemove',
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      button: e.button,
    };
    runtime.sendInput(input);
  }, []);

  // Attach input listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    window.addEventListener('keydown', handleKeyEvent);
    window.addEventListener('keyup', handleKeyEvent);
    canvas.addEventListener('mousedown', handleMouseEvent);
    canvas.addEventListener('mouseup', handleMouseEvent);
    canvas.addEventListener('mousemove', handleMouseEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyEvent);
      window.removeEventListener('keyup', handleKeyEvent);
      canvas.removeEventListener('mousedown', handleMouseEvent);
      canvas.removeEventListener('mouseup', handleMouseEvent);
      canvas.removeEventListener('mousemove', handleMouseEvent);
    };
  }, [handleKeyEvent, handleMouseEvent]);

  const handleRetry = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    runtimeRef.current?.destroy();

    const runtime = new WasmGameRuntime();
    runtimeRef.current = runtime;
    runtime.setOnStateChange((newState) => {
      setState(newState);
      onStateChange?.(newState);
    });

    runtime
      .load(wasmUrl, canvas, mergedConfig)
      .then(() => runtime.start())
      .catch(() => {});
  }, [wasmUrl, onStateChange]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        tabIndex={0}
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Loading overlay */}
      {state.status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-dark/90">
          <Loader2 className="w-10 h-10 text-molt-400 animate-spin mb-4" />
          <p className="text-white/70 text-sm font-medium">Loading {gameName}...</p>
          <p className="text-white/30 text-xs mt-1">Fetching WASM bundle</p>
        </div>
      )}

      {/* Error overlay */}
      {state.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-dark/95">
          <AlertTriangle className="w-10 h-10 text-accent-coral mb-4" />
          <p className="text-white/80 text-sm font-medium mb-1">Failed to load game</p>
          <p className="text-white/40 text-xs max-w-md text-center mb-4">
            {state.error || 'The WASM bundle could not be loaded.'}
          </p>
          <button onClick={handleRetry} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* FPS counter (only when running) */}
      {state.status === 'running' && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-xs font-mono text-white/50">
          {state.fps} FPS
        </div>
      )}

      {/* Paused overlay */}
      {state.status === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="text-white text-2xl font-display font-bold tracking-wider uppercase">
            Paused
          </p>
        </div>
      )}
    </div>
  );
}
