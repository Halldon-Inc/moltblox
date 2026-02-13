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

// Colors assigned to each pair value (1-8)
const VALUE_COLORS: Record<number, string> = {
  1: 'text-neon-cyan',
  2: 'text-accent-amber',
  3: 'text-molt-400',
  4: 'text-neon-pink',
  5: 'text-accent-coral',
  6: 'text-molt-200',
  7: 'text-neon-orange',
  8: 'text-molt-300',
};

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear temp state on restart
  const handleRestart = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTempRevealed({});
    setLocked(false);
    restart();
  }, [restart]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const data: PuzzleData | null = (state?.data as unknown as PuzzleData) ?? null;

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
        // Temporarily reveal the second card with its actual value.
        // We grab the value from the grid — the engine hasn't processed yet.
        // After dispatch, the engine will either match or hide both.
        // We lock input and show both for ~800ms before clearing temp state.

        // First, peek at the grid value. The engine state grid may be fog-of-war (0),
        // so we dispatch first, then check the result.
        const result = dispatch('select', { index });
        if (!result?.success) return;

        // Check if it was a match by looking at the new state
        const newData = result.newState?.data as unknown as PuzzleData | undefined;
        if (newData && !newData.matched[index]) {
          // Mismatch — both cards were un-revealed by the engine.
          // Show them temporarily with the values from the match_failed event
          // or from the newData grid (which may be 0 after fog-of-war reset).
          // We stored the first selected card value before dispatch, so we
          // need to use events. Actually, let's use a simpler approach:
          // store the value from the pre-dispatch state and the dispatched index.

          // The pre-dispatch grid had the first card revealed (non-zero) and
          // the second card unrevealed (0). But the actual values are in the
          // engine's internal state. Since we can't access hidden values,
          // we'll rely on the match_failed event which contains the indices.

          // Simpler: show a brief "flip back" animation by keeping the cards
          // in a "was-revealed" state via CSS classes.
          const firstIdx = data.selected!;
          setTempRevealed({ [firstIdx]: data.grid[firstIdx], [index]: 0 });
          setLocked(true);

          timeoutRef.current = setTimeout(() => {
            setTempRevealed({});
            setLocked(false);
          }, 800);
        }
      } else {
        // First pick — just dispatch, engine will reveal it
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
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <div className="text-sm text-white/60">
            Moves: <span className="font-mono font-bold text-white">{data.moves}</span>
          </div>
          <div className="text-sm text-white/60">
            Pairs: <span className="font-mono font-bold text-neon-cyan">{data.matches}/8</span>
          </div>
        </div>
        <div className="text-sm text-white/60">
          Score:{' '}
          <span className="font-mono font-bold text-accent-amber">
            {scorePreview.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 4x4 Grid */}
      <div
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
            isMatched || isRevealed ? value : isTempRevealed ? tempRevealed[index] || value : 0;
          const colorClass = displayValue > 0 ? VALUE_COLORS[displayValue] || 'text-white' : '';

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
                  className={`
                    absolute inset-0 rounded-xl flex items-center justify-center
                    bg-surface-card border border-white/10
                    transition-all duration-200
                    ${!isMatched && !showFace ? 'hover:border-neon-cyan/40 hover:shadow-neon-sm cursor-pointer' : ''}
                    ${isSelected ? 'border-neon-cyan shadow-neon-sm' : ''}
                  `}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <span className="text-2xl font-bold text-white/20 select-none">?</span>
                </div>

                {/* Front face (revealed card) */}
                <div
                  className={`
                    absolute inset-0 rounded-xl flex items-center justify-center
                    bg-surface-card border
                    transition-all duration-200
                    ${isMatched ? 'border-molt-500 shadow-[0_0_16px_rgba(20,184,166,0.4)] opacity-80' : 'border-neon-cyan/60'}
                  `}
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <span className={`text-3xl font-display font-bold select-none ${colorClass}`}>
                    {displayValue || ''}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
