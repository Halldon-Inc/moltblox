'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PuzzleGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface PuzzleData {
  grid: number[];
  revealed: boolean[];
  matched: boolean[];
  selected: number | null;
  moves: number;
  matches: number;
  gridSize: number;
}

// Default colors assigned to each pair value (1-8) with hex for glow effects
const DEFAULT_VALUE_COLORS: Record<number, string> = {
  1: 'text-neon-cyan',
  2: 'text-accent-amber',
  3: 'text-molt-400',
  4: 'text-neon-pink',
  5: 'text-accent-coral',
  6: 'text-molt-200',
  7: 'text-neon-orange',
  8: 'text-molt-300',
};

const DEFAULT_VALUE_HEX: Record<number, string> = {
  1: '#00e5ff',
  2: '#e87927',
  3: '#14b8a6',
  4: '#ff80ab',
  5: '#ff6b6b',
  6: '#5eead4',
  7: '#ff9800',
  8: '#2dd4bf',
};

const DEFAULT_MATCH_EFFECT_COLOR = '#00e5ff';

interface MatchParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

let particleId = 0;

function spawnMatchParticles(centerX: number, centerY: number, color: string): MatchParticle[] {
  const particles: MatchParticle[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.5 + 1;
    particles.push({
      id: particleId++,
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 500 + Math.random() * 400,
      maxLife: 700,
      color,
      size: 2 + Math.random() * 4,
    });
  }
  return particles;
}

export default function PuzzleRenderer({
  gameName,
  gameConfig,
}: {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}) {
  const { state, events, isGameOver, winner, scores, dispatch, restart } = useGameEngine(
    PuzzleGame,
    gameConfig,
  );

  // Track temporarily revealed cards for flip animation on mismatch.
  // The engine immediately hides non-matching pairs, so we hold them
  // visible locally for a brief period so the player can see both cards.
  const [tempRevealed, setTempRevealed] = useState<Record<number, number>>({});
  const [locked, setLocked] = useState(false);
  const [matchParticles, setMatchParticles] = useState<MatchParticle[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<MatchParticle[]>([]);
  const lastTimeRef = useRef(0);
  const prevMatchCount = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Particle animation loop
  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const current = particlesRef.current;
      if (current.length > 0) {
        const alive: MatchParticle[] = [];
        for (const p of current) {
          p.life -= dt;
          if (p.life > 0) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04;
            alive.push(p);
          }
        }
        particlesRef.current = alive;
        setMatchParticles([...alive]);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Clear temp state on restart
  const handleRestart = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTempRevealed({});
    setLocked(false);
    prevMatchCount.current = 0;
    particlesRef.current = [];
    setMatchParticles([]);
    restart();
  }, [restart]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const data: PuzzleData | null = (state?.data as unknown as PuzzleData) ?? null;

  // Read visual config from _config
  const cfg = ((state?.data as Record<string, unknown>)?._config ?? {}) as Record<string, unknown>;
  const theme = (cfg.theme ?? {}) as Record<string, unknown>;
  const cfgCardColors = theme.cardColors as Record<string, string> | undefined;
  const matchEffectColor = (theme.matchEffectColor as string) ?? DEFAULT_MATCH_EFFECT_COLOR;

  // Build VALUE_HEX from config (override defaults with config values keyed by number)
  const VALUE_HEX: Record<number, string> = { ...DEFAULT_VALUE_HEX };
  if (cfgCardColors) {
    for (const [k, v] of Object.entries(cfgCardColors)) {
      const n = Number(k);
      if (n >= 1 && n <= 8) VALUE_HEX[n] = v;
    }
  }

  // VALUE_COLORS is used for Tailwind classes; keep defaults (hex overrides do the visual work)
  const VALUE_COLORS = DEFAULT_VALUE_COLORS;

  // Suppress lint about matchEffectColor being unused; it's used in the JSX below
  void matchEffectColor;

  // Detect new matches and spawn celebration particles
  useEffect(() => {
    if (!data) return;
    if (data.matches > prevMatchCount.current && prevMatchCount.current > 0) {
      // Find the matched card indices (the ones that just got matched)
      // Spawn particles around the grid center as a celebration
      const matchedIndices: number[] = [];
      for (let i = 0; i < data.matched.length; i++) {
        if (data.matched[i]) matchedIndices.push(i);
      }
      // Get the last two matched cards
      const lastTwo = matchedIndices.slice(-2);
      for (const idx of lastTwo) {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        // Approximate position relative to grid
        const cx = col * 92 + 46;
        const cy = row * 92 + 46;
        const val = data.grid[idx] || 1;
        const color = VALUE_HEX[val] || '#fff';
        const newP = spawnMatchParticles(cx, cy, color);
        particlesRef.current = [...particlesRef.current, ...newP];
        setMatchParticles([...particlesRef.current]);
      }
    }
    prevMatchCount.current = data.matches;
  }, [data]);

  const handleSelect = useCallback(
    (index: number) => {
      if (!data || locked || isGameOver) return;
      if (data.matched[index] || data.revealed[index]) return;
      if (tempRevealed[index] !== undefined) return;

      // If we already have a first card selected, this is the second pick.
      // We need to temporarily reveal both so the player can see the pair
      // before the engine potentially hides them.
      const isSecondPick = data.selected !== null;

      if (isSecondPick) {
        const result = dispatch('select', { index });
        if (!result?.success) return;

        // Check if it was a match by looking at the new state
        const newData = result.newState?.data as unknown as PuzzleData | undefined;
        if (newData && !newData.matched[index]) {
          // Mismatch: show them temporarily
          const firstIdx = data.selected!;
          setTempRevealed({ [firstIdx]: data.grid[firstIdx], [index]: 0 });
          setLocked(true);

          timeoutRef.current = setTimeout(() => {
            setTempRevealed({});
            setLocked(false);
          }, 800);
        }
      } else {
        // First pick: just dispatch, engine will reveal it
        dispatch('select', { index });
      }
    },
    [data, locked, isGameOver, tempRevealed, dispatch],
  );

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scorePreview = Math.max(0, 1000 - (data.moves - 8) * 50);

  return (
    <GameShell
      name={gameName || 'Match Pairs'}
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={handleRestart}
    >
      <style>{`
        @keyframes puzzle-card-hover-glow {
          0% { box-shadow: 0 0 0 0 rgba(0,229,255,0); }
          50% { box-shadow: 0 0 12px 2px rgba(0,229,255,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(0,229,255,0); }
        }
        @keyframes puzzle-match-pop {
          0% { transform: rotateY(180deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.08); }
          100% { transform: rotateY(180deg) scale(1); }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-xl">
        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[5]"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Background pattern: subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), ' +
              'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient glow behind the grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 60%, rgba(0,229,255,0.04) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-[2] p-4">
          {/* Stats bar with enhanced typography */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Moves:{' '}
                <span
                  className="font-mono font-bold"
                  style={{
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                >
                  {data.moves}
                </span>
              </div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Pairs:{' '}
                <span
                  className="font-mono font-bold"
                  style={{
                    color: '#00e5ff',
                    textShadow: '0 0 8px rgba(0,229,255,0.4), 0 1px 3px rgba(0,0,0,0.5)',
                  }}
                >
                  {data.matches}/8
                </span>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Score:{' '}
              <span
                className="font-mono font-bold"
                style={{
                  color: '#e87927',
                  textShadow: '0 0 8px rgba(232,121,39,0.4), 0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                {scorePreview.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 4x4 Grid with particle overlay */}
          <div className="relative">
            {/* Match celebration particles */}
            {matchParticles.map((p) => {
              const alpha = Math.max(0, p.life / p.maxLife);
              return (
                <div
                  key={p.id}
                  className="absolute rounded-full pointer-events-none z-10"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    opacity: alpha,
                    boxShadow: `0 0 ${p.size + 2}px ${p.color}`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}

            <div
              ref={gridRef}
              className="grid grid-cols-4 gap-3 max-w-[356px] mx-auto"
              style={{ perspective: '800px' }}
            >
              {data.grid.map((value, index) => {
                const isMatched = data.matched[index];
                const isRevealed = data.revealed[index];
                const isSelected = data.selected === index;
                const isTempRevealed = tempRevealed[index] !== undefined;
                const showFace = isRevealed || isMatched || isTempRevealed;

                // Determine displayed value
                const displayValue =
                  isMatched || isRevealed
                    ? value
                    : isTempRevealed
                      ? tempRevealed[index] || value
                      : 0;
                const colorClass =
                  displayValue > 0 ? VALUE_COLORS[displayValue] || 'text-white' : '';
                const hexColor = displayValue > 0 ? VALUE_HEX[displayValue] || '#fff' : '#fff';

                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(index)}
                    disabled={isMatched || locked || isGameOver}
                    className="relative w-[80px] h-[80px] mx-auto"
                    style={{ perspective: '400px' }}
                    aria-label={
                      isMatched
                        ? `Matched pair ${value}`
                        : showFace
                          ? `Card ${value}`
                          : `Hidden card ${index + 1}`
                    }
                  >
                    <div
                      className="relative w-full h-full transition-transform duration-[400ms]"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: showFace ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Back face (hidden card) */}
                      <div
                        className="absolute inset-0 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{
                          backfaceVisibility: 'hidden',
                          background:
                            'linear-gradient(135deg, rgba(30,30,50,0.9) 0%, rgba(20,20,35,0.95) 100%)',
                          border: isSelected
                            ? '1px solid rgba(0,229,255,0.6)'
                            : '1px solid rgba(255,255,255,0.08)',
                          boxShadow: isSelected
                            ? '0 0 12px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)',
                        }}
                      >
                        <span
                          className="text-2xl font-bold select-none"
                          style={{ color: 'rgba(255,255,255,0.15)' }}
                        >
                          ?
                        </span>
                      </div>

                      {/* Front face (revealed card) */}
                      <div
                        className="absolute inset-0 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          background: isMatched
                            ? `linear-gradient(135deg, rgba(30,30,50,0.7) 0%, rgba(20,20,35,0.7) 100%)`
                            : 'linear-gradient(135deg, rgba(30,30,50,0.95) 0%, rgba(20,20,35,0.95) 100%)',
                          border: isMatched
                            ? `1px solid ${hexColor}88`
                            : '1px solid rgba(0,229,255,0.4)',
                          boxShadow: isMatched
                            ? `0 0 16px ${hexColor}44, inset 0 1px 0 rgba(255,255,255,0.05)`
                            : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                          opacity: isMatched ? 0.75 : 1,
                        }}
                      >
                        <span
                          className={`text-3xl font-display font-bold select-none ${colorClass}`}
                          style={{
                            textShadow:
                              displayValue > 0
                                ? `0 0 10px ${hexColor}88, 0 2px 4px rgba(0,0,0,0.5)`
                                : 'none',
                          }}
                        >
                          {displayValue || ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
