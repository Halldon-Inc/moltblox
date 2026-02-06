'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, X, Maximize, Minimize, Volume2, VolumeX, Wifi } from 'lucide-react';
import WasmGameLoader from './WasmGameLoader';
import type { RuntimeState } from '@/lib/wasm-runtime';

interface GamePlayerProps {
  wasmUrl?: string;
  gameName: string;
  onExit: () => void;
}

export default function GamePlayer({ wasmUrl, gameName, onExit }: GamePlayerProps) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes (e.g. Escape key)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Escape key to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onExit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  const handleStateChange = useCallback((state: RuntimeState) => {
    setRuntimeState(state);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-surface-dark rounded-2xl border border-white/10 overflow-hidden"
    >
      {/* Game canvas area */}
      <div className="relative flex-1 min-h-0">
        {wasmUrl ? (
          <WasmGameLoader
            wasmUrl={wasmUrl}
            gameName={gameName}
            paused={paused}
            onStateChange={handleStateChange}
          />
        ) : (
          <DemoPlaceholder gameName={gameName} />
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card border-t border-white/5">
        {/* Left: game info */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-white truncate">{gameName}</span>
          {runtimeState?.status === 'running' && (
            <span className="text-xs font-mono text-white/30">{runtimeState.fps} FPS</span>
          )}
        </div>

        {/* Center: playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={togglePause}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>

        {/* Right: multiplayer status + exit */}
        <div className="flex items-center gap-2">
          {/* WebSocket multiplayer placeholder */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-xs text-white/30">
            <Wifi className="w-3 h-3" />
            <span>Solo</span>
          </div>
          <button
            onClick={onExit}
            className="p-2 rounded-lg text-white/40 hover:text-accent-coral hover:bg-accent-coral/10 transition-colors"
            title="Exit game"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Demo Placeholder ──────────────────────────────────────────────────────

function DemoPlaceholder({ gameName }: { gameName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 960;
    canvas.height = 540;

    let animFrame: number;
    let t = 0;

    const draw = () => {
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;

      // Dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Animated grid
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offset = (t * 10) % gridSize;
      for (let x = offset; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offset; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Floating cubes
      for (let i = 0; i < 8; i++) {
        const cx = w * 0.2 + w * 0.6 * ((i * 0.137) % 1);
        const cy = h * 0.3 + Math.sin(t + i * 1.5) * 40;
        const size = 12 + Math.sin(t * 0.5 + i) * 4;
        const alpha = 0.15 + Math.sin(t + i) * 0.08;
        ctx.fillStyle = `rgba(20, 184, 166, ${alpha})`;
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      }

      // Game name
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px "Space Grotesk", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(gameName, w / 2, h / 2 - 20);

      // Subtitle
      ctx.font = '14px "Inter", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillText('Waiting for game bundle...', w / 2, h / 2 + 20);

      // Animated dots
      const dots = '.'.repeat(1 + (Math.floor(t * 2) % 3));
      ctx.fillText(dots, w / 2 + 110, h / 2 + 20);

      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [gameName]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}
