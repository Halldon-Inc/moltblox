'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ClickerGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';
import { MousePointerClick, Zap } from 'lucide-react';

interface ClickerData {
  clicks: Record<string, number>;
  targetClicks: number;
  lastAction: string | null;
}

export default function ClickerRenderer() {
  const { state, events, isGameOver, winner, scores, playerId, dispatch, restart } =
    useGameEngine(ClickerGame);

  const [ripple, setRipple] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const prevEventsLen = useRef(0);

  const data = (state?.data as unknown as ClickerData) ?? {
    clicks: {},
    targetClicks: 100,
    lastAction: null,
  };
  const myClicks = data.clicks[playerId] ?? 0;
  const target = data.targetClicks;
  const progress = Math.min((myClicks / target) * 100, 100);

  // Detect new milestone events
  useEffect(() => {
    if (events.length > prevEventsLen.current) {
      const newEvents = events.slice(prevEventsLen.current);
      if (newEvents.some((e) => e.type === 'milestone')) {
        setMilestone(true);
        const timer = setTimeout(() => setMilestone(false), 800);
        return () => clearTimeout(timer);
      }
    }
    prevEventsLen.current = events.length;
  }, [events]);

  const handleClick = useCallback(() => {
    dispatch('click');
    setRipple(true);
    setTimeout(() => setRipple(false), 400);
  }, [dispatch]);

  const handleMultiClick = useCallback(() => {
    dispatch('multi_click', { amount: 5 });
    setRipple(true);
    setTimeout(() => setRipple(false), 400);
  }, [dispatch]);

  return (
    <GameShell
      name="Click Race"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      {/* Scoped keyframes */}
      <style>{`
        @keyframes clicker-ripple {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,121,39,0.5); }
          50% { transform: scale(1.08); box-shadow: 0 0 30px 10px rgba(232,121,39,0.3); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(232,121,39,0); }
        }
        @keyframes clicker-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes milestone-flash {
          0% { opacity: 0; transform: scale(0.8); }
          20% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes milestone-particle {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.5); }
        }
        .clicker-btn-ripple { animation: clicker-ripple 0.4s ease-out; }
        .clicker-ring { animation: clicker-pulse-ring 0.6s ease-out forwards; }
        .milestone-burst { animation: milestone-flash 0.8s ease-out forwards; }
        .milestone-particle { animation: milestone-particle 0.8s ease-out forwards; }
      `}</style>

      <div className="flex flex-col items-center justify-center min-h-[420px] gap-8 relative">
        {/* Milestone celebration overlay */}
        {milestone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="milestone-burst text-accent-amber text-3xl font-display font-bold">
              Milestone!
            </div>
            {/* Particles */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="milestone-particle absolute w-2 h-2 rounded-full bg-accent-amber"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `rotate(${i * 45}deg) translateX(40px)`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Click count */}
        <div className="text-center">
          <div className="text-6xl font-mono font-bold text-neon-cyan tabular-nums">{myClicks}</div>
          <div className="text-sm text-white/50 mt-1">of {target} clicks</div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>Progress</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-molt-500 to-neon-cyan rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Click button */}
        <div className="relative">
          {/* Ripple ring */}
          {ripple && (
            <div className="clicker-ring absolute inset-0 rounded-full border-2 border-molt-500 pointer-events-none" />
          )}

          <button
            onClick={handleClick}
            disabled={isGameOver}
            className={[
              'relative w-[150px] h-[150px] rounded-full',
              'bg-molt-500 hover:bg-molt-400',
              'flex flex-col items-center justify-center gap-1',
              'text-white font-display font-bold text-lg',
              'shadow-lg shadow-molt-500/30',
              'hover:shadow-xl hover:shadow-molt-500/50',
              'transition-all duration-150',
              'active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-molt-500/50 focus:ring-offset-2 focus:ring-offset-surface-dark',
              'select-none cursor-pointer',
              ripple ? 'clicker-btn-ripple' : '',
            ].join(' ')}
          >
            <MousePointerClick className="w-8 h-8" />
            CLICK
          </button>
        </div>

        {/* Multi-click button */}
        <button
          onClick={handleMultiClick}
          disabled={isGameOver}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-neon-cyan/10 border border-neon-cyan/30',
            'text-neon-cyan text-sm font-semibold',
            'hover:bg-neon-cyan/20 hover:border-neon-cyan/50',
            'transition-all duration-150',
            'active:scale-95',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'select-none cursor-pointer',
          ].join(' ')}
        >
          <Zap className="w-4 h-4" />
          Multi-Click (x5)
        </button>
      </div>
    </GameShell>
  );
}
