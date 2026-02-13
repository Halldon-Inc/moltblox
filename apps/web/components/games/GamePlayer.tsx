'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, X, Maximize, Minimize, Volume2, VolumeX, Wifi } from 'lucide-react';
import Link from 'next/link';
import WasmGameLoader from './WasmGameLoader';
import TemplateGamePlayer from './TemplateGamePlayer';
import type { RuntimeState } from '@/lib/wasm-runtime';

interface GamePlayerProps {
  wasmUrl?: string;
  templateSlug?: string;
  gameId?: string;
  gameName: string;
  gameConfig?: Record<string, unknown>;
  thumbnail?: string;
  onExit: () => void;
}

export default function GamePlayer({
  wasmUrl,
  templateSlug,
  gameId,
  gameName,
  gameConfig,
  thumbnail,
  onExit,
}: GamePlayerProps) {
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
        {templateSlug ? (
          <TemplateGamePlayer
            templateSlug={templateSlug}
            gameId={gameId}
            gameName={gameName}
            gameConfig={gameConfig}
            onExit={onExit}
          />
        ) : wasmUrl ? (
          <WasmGameLoader
            wasmUrl={wasmUrl}
            gameName={gameName}
            paused={paused}
            onStateChange={handleStateChange}
          />
        ) : (
          <ComingSoon gameName={gameName} thumbnail={thumbnail} />
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

// ─── Coming Soon ───────────────────────────────────────────────────────────

function ComingSoon({ gameName, thumbnail }: { gameName: string; thumbnail?: string }) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
      {/* Background: thumbnail or gradient fallback */}
      {thumbnail && !thumbnail.startsWith('#') ? (
        <img
          src={thumbnail}
          alt={gameName}
          className="absolute inset-0 w-full h-full object-cover blur-sm opacity-30"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-molt-600/20 via-surface-dark to-neon-cyan/10" />
      )}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(20,184,166,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Play className="w-7 h-7 text-white/30" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white/80">{gameName}</h3>
          <p className="text-sm text-white/40 mt-1">Coming Soon</p>
        </div>
        <p className="text-xs text-white/25 max-w-xs">
          This game is still being built. Check back later to play!
        </p>
        <Link
          href="/games"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          Back to Games
        </Link>
      </div>
    </div>
  );
}
