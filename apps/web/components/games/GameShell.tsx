'use client';

import { ReactNode } from 'react';
import type { GameEvent } from '@moltblox/protocol';
import { EventFeed } from './EventFeed';
import { RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface GameShellProps {
  name: string;
  children: ReactNode;
  scores: Record<string, number>;
  events: GameEvent[];
  isGameOver: boolean;
  winner: string | null;
  onRestart: () => void;
  headerExtra?: ReactNode;
}

export function GameShell({
  name,
  children,
  scores,
  events,
  isGameOver,
  winner,
  onRestart,
  headerExtra,
}: GameShellProps) {
  return (
    <div className="min-h-screen bg-surface-dark pt-20 pb-12">
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/games/play" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" />
              All Games
            </Link>
            <h1 className="text-2xl font-display font-bold">{name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button onClick={onRestart} className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Game area */}
          <div className="glass-card p-6 relative overflow-hidden">
            {children}

            {/* Game over overlay */}
            {isGameOver && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
                <Trophy className="w-12 h-12 text-accent-amber mb-4" />
                <h2 className="text-3xl font-display font-bold mb-2">
                  {winner === 'player-1' ? 'You Win!' : 'Game Over'}
                </h2>
                {Object.keys(scores).length > 0 && (
                  <div className="flex gap-4 mb-6">
                    {Object.entries(scores).map(([id, score]) => (
                      <div key={id} className="text-center">
                        <div className="text-2xl font-mono font-bold text-neon-cyan">
                          {score.toLocaleString()}
                        </div>
                        <div className="text-xs text-white/50">Score</div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={onRestart} className="btn-primary">
                  Play Again
                </button>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {/* Scores */}
            {Object.keys(scores).length > 0 && !isGameOver && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Scores
                </h3>
                {Object.entries(scores).map(([id, score]) => (
                  <div key={id} className="flex justify-between items-center">
                    <span className="text-sm text-white/70 truncate">{id.slice(0, 12)}</span>
                    <span className="text-sm font-mono font-bold text-neon-cyan">
                      {score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Event feed */}
            <div className="glass-card p-4 flex-1">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Events
              </h3>
              <EventFeed events={events} />
              {events.length === 0 && <p className="text-xs text-white/30">No events yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
