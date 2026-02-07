'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { RPGGame } from '@moltblox/game-builder';
import { useGameEngine } from '@/hooks/useGameEngine';
import { GameShell } from '@/components/games/GameShell';

interface CharacterStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  mp: number;
  maxMp: number;
}

interface Skill {
  name: string;
  mpCost: number;
  damage: number;
  effect?: 'heal' | 'buff_atk' | 'buff_def';
  effectValue?: number;
}

interface PlayerData {
  stats: CharacterStats;
  level: number;
  xp: number;
  xpToLevel: number;
  skills: Skill[];
  items: Record<string, number>;
  buffs: Record<string, number>;
}

interface Enemy {
  name: string;
  stats: CharacterStats;
  reward: number;
}

interface RPGData {
  players: Record<string, PlayerData>;
  currentEnemy: Enemy | null;
  encounter: number;
  maxEncounters: number;
  turnOrder: string[];
  currentTurnIndex: number;
  combatLog: string[];
}

const ENEMY_EMOJI: Record<string, string> = {
  Slime: '\u{1F9CA}',
  Goblin: '\u{1F47A}',
  Skeleton: '\u{1F480}',
  'Dark Knight': '\u{2694}\u{FE0F}',
  Dragon: '\u{1F409}',
};

const EMPTY_DATA: RPGData = {
  players: {},
  currentEnemy: null,
  encounter: 0,
  maxEncounters: 10,
  turnOrder: [],
  currentTurnIndex: 0,
  combatLog: [],
};

function HPBar({
  current,
  max,
  color,
  label,
}: {
  current: number;
  max: number;
  color: 'hp' | 'mp' | 'enemy';
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const gradients = {
    hp: 'from-green-500 to-emerald-400',
    mp: 'from-blue-500 to-cyan-400',
    enemy: 'from-red-600 to-rose-400',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-white/80">
          {Math.max(0, current)}/{max}
        </span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradients[color]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function XPBar({ xp, xpToLevel }: { xp: number; xpToLevel: number }) {
  const pct = Math.min(100, (xp / xpToLevel) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">XP</span>
        <span className="font-mono text-accent-amber">
          {xp}/{xpToLevel}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-amber to-yellow-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RPGRenderer() {
  const { state, events, isGameOver, winner, scores, dispatch, playerId, restart } =
    useGameEngine(RPGGame);

  const logEndRef = useRef<HTMLDivElement>(null);
  const [lastReward, setLastReward] = useState<{ enemy: string; xp: number } | null>(null);

  const data = (state?.data as unknown as RPGData) ?? EMPTY_DATA;
  const player = data.players[playerId] as unknown as PlayerData | undefined;
  const enemy = data.currentEnemy;
  const inCombat = enemy !== null;
  const isPlayerTurn =
    inCombat && data.turnOrder.length > 0 && data.turnOrder[data.currentTurnIndex] === playerId;

  // Auto-scroll combat log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data.combatLog.length]);

  // Detect enemy defeated for loot summary
  const prevEnemyRef = useRef<Enemy | null>(null);
  useEffect(() => {
    if (prevEnemyRef.current && !enemy) {
      setLastReward({ enemy: prevEnemyRef.current.name, xp: prevEnemyRef.current.reward });
      const timer = setTimeout(() => setLastReward(null), 3000);
      prevEnemyRef.current = enemy;
      return () => clearTimeout(timer);
    }
    prevEnemyRef.current = enemy;
  }, [enemy]);

  const handleStartEncounter = useCallback(() => {
    setLastReward(null);
    dispatch('start_encounter');
  }, [dispatch]);

  const handleAttack = useCallback(() => {
    dispatch('attack');
  }, [dispatch]);

  const handleSkill = useCallback(
    (skillIndex: number) => {
      dispatch('use_skill', { skillIndex });
    },
    [dispatch],
  );

  const handleItem = useCallback(
    (item: string) => {
      dispatch('use_item', { item });
    },
    [dispatch],
  );

  if (!player) {
    return (
      <GameShell
        name="Dungeon Crawl"
        scores={scores}
        events={events}
        isGameOver={isGameOver}
        winner={winner}
        onRestart={restart}
      >
        <div className="flex items-center justify-center min-h-[400px] text-white/50">
          Loading...
        </div>
      </GameShell>
    );
  }

  const allEncountersDone = data.encounter >= data.maxEncounters && !inCombat;
  const buffKeys = Object.keys(player.buffs);

  return (
    <GameShell
      name="Dungeon Crawl"
      scores={scores}
      events={events}
      isGameOver={isGameOver}
      winner={winner}
      onRestart={restart}
    >
      <style jsx>{`
        @keyframes rpg-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        @keyframes rpg-flash {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes rpg-reward-slide {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          20% {
            opacity: 1;
            transform: translateY(0);
          }
          80% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
        .rpg-reward {
          animation: rpg-reward-slide 3s ease-out forwards;
        }
      `}</style>

      <div className="flex flex-col gap-4 min-h-[480px]">
        {/* Encounter counter */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Encounter {data.encounter}/{data.maxEncounters}
          </span>
          <span className="text-xs font-mono text-accent-amber">Lv.{player.level}</span>
        </div>

        {/* Enemy display */}
        {inCombat && enemy ? (
          <div className="glass-card p-4 border border-accent-coral/20 bg-accent-coral/5">
            <div className="flex items-center gap-4">
              <div className="text-5xl select-none flex-shrink-0 w-16 text-center">
                {ENEMY_EMOJI[enemy.name] || '\u{1F47E}'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display font-bold text-lg text-white">{enemy.name}</span>
                  <span className="text-xs text-white/40 font-mono">
                    ATK {enemy.stats.atk} / DEF {enemy.stats.def}
                  </span>
                </div>
                <HPBar current={enemy.stats.hp} max={enemy.stats.maxHp} color="enemy" label="HP" />
              </div>
            </div>
          </div>
        ) : lastReward ? (
          <div className="rpg-reward glass-card p-4 border border-accent-amber/30 bg-accent-amber/5 text-center">
            <span className="text-accent-amber font-display font-bold">
              {lastReward.enemy} defeated!
            </span>
            <span className="text-white/60 ml-2 font-mono text-sm">+{lastReward.xp} XP</span>
          </div>
        ) : !allEncountersDone ? (
          <div className="glass-card p-8 flex flex-col items-center justify-center border border-molt-500/20">
            <div className="text-4xl mb-3 select-none">{'\u{1F5E1}\u{FE0F}'}</div>
            <p className="text-white/50 text-sm mb-4">
              {data.encounter === 0 ? 'A dungeon lies ahead...' : 'Prepare for the next encounter'}
            </p>
            <button
              onClick={handleStartEncounter}
              disabled={isGameOver}
              className={[
                'px-6 py-3 rounded-lg font-display font-bold text-lg',
                'bg-molt-500 hover:bg-molt-400 text-white',
                'shadow-lg shadow-molt-500/30 hover:shadow-xl hover:shadow-molt-500/50',
                'transition-all duration-150 active:scale-95',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'select-none cursor-pointer',
              ].join(' ')}
            >
              Begin Encounter
            </button>
          </div>
        ) : null}

        {/* Player stats panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* HP / MP / XP */}
          <div className="glass-card p-3 space-y-2">
            <HPBar current={player.stats.hp} max={player.stats.maxHp} color="hp" label="HP" />
            <HPBar current={player.stats.mp} max={player.stats.maxMp} color="mp" label="MP" />
            <XPBar xp={player.xp} xpToLevel={player.xpToLevel} />
          </div>

          {/* Stats + buffs */}
          <div className="glass-card p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">ATK</span>
                <span className="font-mono text-white">
                  {player.stats.atk}
                  {player.buffs['buff_atk'] ? (
                    <span className="text-accent-amber ml-1">+5</span>
                  ) : null}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">DEF</span>
                <span className="font-mono text-white">
                  {player.stats.def}
                  {player.buffs['buff_def'] ? (
                    <span className="text-neon-cyan ml-1">+5</span>
                  ) : null}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">SPD</span>
                <span className="font-mono text-white">{player.stats.spd}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Level</span>
                <span className="font-mono text-accent-amber">{player.level}</span>
              </div>
            </div>
            {buffKeys.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {buffKeys.map((b) => (
                  <span
                    key={b}
                    className={[
                      'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                      b === 'buff_atk'
                        ? 'bg-accent-amber/20 text-accent-amber'
                        : 'bg-neon-cyan/20 text-neon-cyan',
                    ].join(' ')}
                  >
                    {b === 'buff_atk' ? 'ATK UP' : 'DEF UP'} ({player.buffs[b]}t)
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action bar — only shown during combat on player turn */}
        {inCombat && (
          <div className="glass-card p-3 space-y-2.5">
            {/* Turn indicator */}
            <div className="text-xs font-semibold text-center">
              {isPlayerTurn ? (
                <span className="text-molt-400">Your turn — choose an action</span>
              ) : (
                <span className="text-white/40">Waiting...</span>
              )}
            </div>

            {/* Attack */}
            <button
              onClick={handleAttack}
              disabled={!isPlayerTurn || isGameOver}
              className={[
                'w-full py-2.5 rounded-lg font-display font-bold',
                'bg-red-600/80 hover:bg-red-500 text-white',
                'transition-all duration-150 active:scale-[0.98]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'select-none cursor-pointer',
              ].join(' ')}
            >
              Attack
            </button>

            {/* Skills row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {player.skills.map((skill, i) => {
                const canUse = isPlayerTurn && player.stats.mp >= skill.mpCost && !isGameOver;
                return (
                  <button
                    key={skill.name}
                    onClick={() => handleSkill(i)}
                    disabled={!canUse}
                    className={[
                      'py-2 px-2 rounded-lg text-xs font-semibold',
                      'bg-blue-600/20 border border-blue-500/30 text-blue-300',
                      'hover:bg-blue-600/40 hover:border-blue-400/50',
                      'transition-all duration-150 active:scale-95',
                      'disabled:opacity-30 disabled:cursor-not-allowed',
                      'select-none cursor-pointer',
                    ].join(' ')}
                  >
                    <div>{skill.name}</div>
                    <div className="text-[10px] text-blue-400/70 font-mono mt-0.5">
                      {skill.mpCost} MP
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Items row */}
            <div className="flex gap-2">
              <button
                onClick={() => handleItem('Potion')}
                disabled={!isPlayerTurn || (player.items['Potion'] ?? 0) <= 0 || isGameOver}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold',
                  'bg-green-600/20 border border-green-500/30 text-green-300',
                  'hover:bg-green-600/40 hover:border-green-400/50',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                Potion ({player.items['Potion'] ?? 0})
                <span className="block text-[10px] text-green-400/70 font-mono">+50 HP</span>
              </button>
              <button
                onClick={() => handleItem('Ether')}
                disabled={!isPlayerTurn || (player.items['Ether'] ?? 0) <= 0 || isGameOver}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-semibold',
                  'bg-cyan-600/20 border border-cyan-500/30 text-cyan-300',
                  'hover:bg-cyan-600/40 hover:border-cyan-400/50',
                  'transition-all duration-150 active:scale-95',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'select-none cursor-pointer',
                ].join(' ')}
              >
                Ether ({player.items['Ether'] ?? 0})
                <span className="block text-[10px] text-cyan-400/70 font-mono">+20 MP</span>
              </button>
            </div>
          </div>
        )}

        {/* Combat log */}
        {data.combatLog.length > 0 && (
          <div className="glass-card p-3">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              Combat Log
            </h3>
            <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin">
              {data.combatLog.slice(-8).map((msg, i) => (
                <p
                  key={`${data.combatLog.length - 8 + i}-${msg.slice(0, 20)}`}
                  className="text-xs font-mono text-white/60 leading-relaxed"
                >
                  {msg}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
