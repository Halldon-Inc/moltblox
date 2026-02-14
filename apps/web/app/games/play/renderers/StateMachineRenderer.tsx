'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Trophy, XCircle } from 'lucide-react';

interface Resource {
  name: string;
  value: number;
  max?: number;
  icon?: string;
}

interface Action {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  cost?: Record<string, number>;
}

interface GameState {
  currentState: string;
  description?: string;
  resources: Resource[];
  availableActions: Action[];
  isWin?: boolean;
  isLose?: boolean;
  endMessage?: string;
}

interface Theme {
  bgColor?: string;
  accentColor?: string;
  resourceIcons?: Record<string, string>;
}

interface StateMachineRendererProps {
  gameState: GameState;
  onAction: (actionId: string) => void;
  theme?: Theme;
}

const DEFAULT_ICONS: Record<string, string> = {
  health: '\u2764\uFE0F',
  gold: '\uD83E\uDE99',
  energy: '\u26A1',
  food: '\uD83C\uDF5E',
  wood: '\uD83E\uDEB5',
  stone: '\uD83E\uDEA8',
  mana: '\uD83D\uDD2E',
  score: '\u2B50',
  lives: '\uD83D\uDC9A',
  time: '\u23F0',
};

export default function StateMachineRenderer({
  gameState,
  onAction,
  theme,
}: StateMachineRendererProps) {
  const [prevState, setPrevState] = useState(gameState.currentState);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (gameState.currentState !== prevState) {
      setTransitioning(true);
      const timer = setTimeout(() => {
        setTransitioning(false);
        setPrevState(gameState.currentState);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [gameState.currentState, prevState]);

  const getResourceIcon = useCallback(
    (name: string): string => {
      const icons = { ...DEFAULT_ICONS, ...theme?.resourceIcons };
      return icons[name.toLowerCase()] || '\u25CF';
    },
    [theme?.resourceIcons],
  );

  const isGameOver = gameState.isWin || gameState.isLose;
  const bgClass = theme?.bgColor || 'bg-surface-dark';

  return (
    <div className={`flex flex-col gap-5 min-h-[420px] relative ${bgClass}`}>
      {/* Current state header */}
      <div
        className={`glass-card p-4 border transition-all duration-300 ${
          transitioning ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'
        } ${
          gameState.isWin
            ? 'border-molt-500/40 bg-molt-500/5'
            : gameState.isLose
              ? 'border-accent-coral/40 bg-accent-coral/5'
              : 'border-white/10'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-5 h-5 text-neon-cyan flex-shrink-0" />
          <h2 className="font-display font-bold text-lg text-white">{gameState.currentState}</h2>
        </div>
        {gameState.description && (
          <p className="text-sm text-white/60 leading-relaxed ml-8">{gameState.description}</p>
        )}
      </div>

      {/* Resources grid */}
      {gameState.resources.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Resources
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gameState.resources.map((resource) => {
              const pct = resource.max
                ? Math.min(100, (resource.value / resource.max) * 100)
                : null;
              return (
                <div
                  key={resource.name}
                  className="bg-white/5 rounded-lg p-3 border border-white/5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base select-none">
                      {resource.icon || getResourceIcon(resource.name)}
                    </span>
                    <span className="text-xs text-white/50 uppercase tracking-wide truncate">
                      {resource.name}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-xl text-white tabular-nums">
                    {resource.value}
                    {resource.max != null && (
                      <span className="text-sm text-white/30">/{resource.max}</span>
                    )}
                  </div>
                  {pct != null && (
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-molt-500 to-neon-cyan rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available actions */}
      {!isGameOver && gameState.availableActions.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Actions
          </h3>
          <div className="flex flex-col gap-2">
            {gameState.availableActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onAction(action.id)}
                disabled={action.disabled}
                className={[
                  'w-full py-3 px-4 rounded-lg text-left',
                  'bg-molt-500/10 border border-molt-500/20',
                  'hover:bg-molt-500/20 hover:border-molt-500/40',
                  'transition-all duration-150 active:scale-[0.98]',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer group',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-white group-hover:text-neon-cyan transition-colors">
                    {action.label}
                  </span>
                  {action.cost && Object.keys(action.cost).length > 0 && (
                    <div className="flex gap-2">
                      {Object.entries(action.cost).map(([res, amt]) => (
                        <span
                          key={res}
                          className="text-xs font-mono text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded"
                        >
                          {amt} {res}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {action.description && (
                  <p className="text-xs text-white/40 mt-1">{action.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Win/Lose overlay */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-2xl">
          {gameState.isWin ? (
            <>
              <Trophy className="w-12 h-12 text-accent-amber mb-4" />
              <h2 className="text-3xl font-display font-bold mb-2 text-white">Victory!</h2>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-accent-coral mb-4" />
              <h2 className="text-3xl font-display font-bold mb-2 text-white">Defeat</h2>
            </>
          )}
          {gameState.endMessage && (
            <p className="text-white/60 text-center max-w-sm mb-4">{gameState.endMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
