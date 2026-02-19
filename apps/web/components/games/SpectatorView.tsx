'use client';

import { Eye, Users, Radio, Zap, Trophy } from 'lucide-react';

interface SpectatorViewProps {
  state: Record<string, unknown> | null;
  gameName: string;
  templateSlug: string | null;
  spectatorCount?: number;
  isConnected?: boolean;
  lastUpdateAt?: number | null;
}

export default function SpectatorView({
  state,
  gameName,
  templateSlug,
  spectatorCount = 0,
  isConnected = false,
  lastUpdateAt,
}: SpectatorViewProps) {
  const isRealTime = state?._isRealTime === true;
  const matchEnded = state?._matchEnded === true;
  const countdown = state?._countdown as number | undefined;
  const winner = state?._winner as string | undefined;
  const finalScores = state?._scores as Record<string, number> | undefined;

  const scores =
    state && typeof state.data === 'object' && state.data !== null
      ? ((state.data as Record<string, unknown>).scores as Record<string, number> | undefined)
      : finalScores;

  const phase = matchEnded
    ? 'ended'
    : (state?.phase as string | undefined) ||
      ((state?.matchState as Record<string, unknown>)?.phase as string | undefined);

  const turn = (state?.turn as number | undefined) ?? (state?.frame as number | undefined);

  const fighters = state?.fighters as Record<string, Record<string, unknown>> | undefined;

  // Time since last update for "live" indicator
  const isReceivingData = lastUpdateAt ? Date.now() - lastUpdateAt < 5000 : false;

  return (
    <div className="relative bg-surface-card border border-white/10 rounded-2xl overflow-hidden">
      {/* Top bar: live indicator + spectator count */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {/* LIVE badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/90 text-white shadow-lg shadow-red-500/20">
            <Radio className="w-3 h-3" />
            {matchEnded ? 'Ended' : isReceivingData ? 'Live' : 'Spectating'}
          </span>
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Spectator count */}
          <span className="flex items-center gap-1.5 text-xs text-white/40">
            <Eye className="w-3.5 h-3.5" />
            {spectatorCount > 0 ? `${spectatorCount} watching` : 'Watching'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
          {gameName}
        </h2>
        <div className="flex items-center gap-4 mt-2 text-sm text-white/50">
          {templateSlug && (
            <span className="bg-white/5 text-white/60 px-2 py-0.5 rounded text-xs font-bold uppercase">
              {templateSlug}
            </span>
          )}
          {phase && (
            <span>
              Phase:{' '}
              <span
                className={`font-medium ${
                  phase === 'ended'
                    ? 'text-accent-coral'
                    : phase === 'fighting' || phase === 'playing'
                      ? 'text-[#00D9A6]'
                      : 'text-white/70'
                }`}
              >
                {phase}
              </span>
            </span>
          )}
          {turn !== undefined && (
            <span>
              {isRealTime ? 'Frame' : 'Turn'}:{' '}
              <span className="text-white/70 font-medium">{turn}</span>
            </span>
          )}
        </div>
      </div>

      {/* Countdown overlay */}
      {countdown !== undefined && countdown > 0 && (
        <div className="px-6 py-8 text-center border-b border-white/10">
          <div className="text-6xl font-display font-black text-molt-400 animate-pulse">
            {countdown}
          </div>
          <p className="text-white/40 text-sm mt-2">Match starting...</p>
        </div>
      )}

      {/* Match ended overlay */}
      {matchEnded && (
        <div className="px-6 py-8 text-center border-b border-white/10 bg-white/[0.02]">
          <Trophy className="w-10 h-10 text-accent-amber mx-auto mb-3" />
          <h3 className="text-xl font-display font-black text-white uppercase">Match Over</h3>
          {winner && (
            <p className="text-[#00D9A6] text-sm mt-1">
              Winner: <span className="font-bold">{winner.slice(0, 8)}...</span>
            </p>
          )}
        </div>
      )}

      {/* Fighter health bars (real-time games) */}
      {isRealTime && fighters && !matchEnded && (
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">
            Fighters
          </h3>
          <div className="space-y-3">
            {Object.entries(fighters).map(([fighterId, fighter]) => {
              const hp = (fighter.health as number) ?? 0;
              const maxHp = (fighter.maxHealth as number) ?? 100;
              const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
              const fighterState = (fighter.state as string) ?? 'idle';

              return (
                <div key={fighterId} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-20 truncate font-mono">
                    {fighterId.slice(0, 8)}
                  </span>
                  <div className="flex-1">
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          hpPercent > 60
                            ? 'bg-[#00D9A6]'
                            : hpPercent > 30
                              ? 'bg-accent-amber'
                              : 'bg-accent-coral'
                        }`}
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-white/50 w-12 text-right">
                    {hp}/{maxHp}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      fighterState === 'attacking'
                        ? 'bg-accent-coral/10 text-accent-coral'
                        : fighterState === 'blocking'
                          ? 'bg-molt-500/10 text-molt-400'
                          : fighterState === 'ko'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-white/5 text-white/30'
                    }`}
                  >
                    {fighterState}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scores section */}
      {scores && Object.keys(scores).length > 0 && (
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Scores</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(scores).map(([playerId, score]) => (
              <div
                key={playerId}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-center"
              >
                <div className="text-xs text-white/50 truncate max-w-[120px] font-mono">
                  {playerId.slice(0, 8)}...
                </div>
                <div className="text-lg font-black text-white">{score}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game state panel */}
      <div className="p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">
          Game State
        </h3>
        {state ? (
          <pre className="bg-surface-dark border border-white/10 rounded-xl p-4 text-sm text-white/60 overflow-x-auto max-h-96 font-mono leading-relaxed">
            {JSON.stringify(
              // Filter internal tracking fields from display
              Object.fromEntries(Object.entries(state).filter(([k]) => !k.startsWith('_'))),
              null,
              2,
            )}
          </pre>
        ) : (
          <div className="bg-surface-dark border border-white/10 rounded-xl p-8 text-center">
            <Zap className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/30 text-sm">Waiting for game state...</p>
          </div>
        )}
      </div>
    </div>
  );
}
