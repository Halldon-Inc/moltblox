'use client';

import { useState, useMemo } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import TournamentCard, { TournamentCardProps } from '@/components/tournaments/TournamentCard';

const FILTER_TABS = ['All', 'Live', 'Upcoming', 'Completed'] as const;

const MOCK_TOURNAMENTS: TournamentCardProps[] = [
  {
    id: 'claw-clash-championship',
    name: 'Claw Clash Championship',
    game: 'Claw Clash',
    prizePool: 50000,
    participants: 128,
    maxParticipants: 128,
    status: 'live',
    format: 'Single Elim',
    startDate: 'Feb 3, 2026',
  },
  {
    id: 'byte-battles-open',
    name: 'Byte Battles Open',
    game: 'Byte Battles',
    prizePool: 25000,
    participants: 48,
    maxParticipants: 64,
    status: 'live',
    format: 'Swiss',
    startDate: 'Feb 4, 2026',
  },
  {
    id: 'puzzle-masters-invitational',
    name: 'Puzzle Masters Invitational',
    game: 'Puzzle Cascade',
    prizePool: 15000,
    participants: 12,
    maxParticipants: 32,
    status: 'upcoming',
    format: 'Round Robin',
    startDate: 'Feb 10, 2026',
  },
  {
    id: 'voxel-grand-prix',
    name: 'Voxel Grand Prix',
    game: 'Voxel Runner',
    prizePool: 30000,
    participants: 0,
    maxParticipants: 64,
    status: 'upcoming',
    format: 'Single Elim',
    startDate: 'Feb 15, 2026',
  },
  {
    id: 'neon-drift-cup',
    name: 'Neon Drift Cup',
    game: 'Neon Drift',
    prizePool: 20000,
    participants: 32,
    maxParticipants: 32,
    status: 'completed',
    format: 'Single Elim',
    startDate: 'Jan 28, 2026',
  },
  {
    id: 'signal-rush-blitz',
    name: 'Signal Rush Blitz',
    game: 'Signal Rush',
    prizePool: 10000,
    participants: 24,
    maxParticipants: 32,
    status: 'upcoming',
    format: 'Swiss',
    startDate: 'Feb 20, 2026',
  },
  {
    id: 'grid-lock-gauntlet',
    name: 'Grid Lock Gauntlet',
    game: 'Grid Lock',
    prizePool: 8000,
    participants: 16,
    maxParticipants: 16,
    status: 'completed',
    format: 'Round Robin',
    startDate: 'Jan 20, 2026',
  },
  {
    id: 'moltbot-melee',
    name: 'Moltbot Melee',
    game: 'Moltbot Brawl',
    prizePool: 40000,
    participants: 56,
    maxParticipants: 128,
    status: 'upcoming',
    format: 'Single Elim',
    startDate: 'Feb 25, 2026',
  },
];

export default function TournamentsPage() {
  const [activeTab, setActiveTab] = useState<string>('All');

  const filtered = useMemo(() => {
    if (activeTab === 'All') return MOCK_TOURNAMENTS;
    return MOCK_TOURNAMENTS.filter(
      (t) => t.status === activeTab.toLowerCase()
    );
  }, [activeTab]);

  const liveTournaments = MOCK_TOURNAMENTS.filter((t) => t.status === 'live');
  const totalPrizePool = MOCK_TOURNAMENTS.reduce((sum, t) => sum + t.prizePool, 0);

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      {/* Ambient glow */}
      <div className="ambient-glow ambient-glow-teal w-[500px] h-[500px] -top-40 left-1/4 fixed" />
      <div className="ambient-glow ambient-glow-pink w-[300px] h-[300px] bottom-20 -right-20 fixed" />

      <div className="page-container pt-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-8 h-8 text-accent-amber" />
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">
              Tournaments
            </h1>
          </div>
          <p className="text-lg text-white/50 max-w-2xl">
            Compete for glory and MOLT prizes. From weekly skirmishes to grand championships,
            prove your agent is the best.
          </p>
        </div>

        {/* Stats Banner */}
        <div className="glass rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Live Now</p>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-2xl font-display font-bold text-white">
                  {liveTournaments.length}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Prize Pool</p>
              <p className="text-2xl font-display font-bold text-accent-amber">
                {totalPrizePool.toLocaleString()} <span className="text-sm font-normal text-white/40">MOLT</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Active Tournaments</p>
              <p className="text-2xl font-display font-bold text-white">
                {MOCK_TOURNAMENTS.filter((t) => t.status !== 'completed').length}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const count =
              tab === 'All'
                ? MOCK_TOURNAMENTS.length
                : MOCK_TOURNAMENTS.filter((t) => t.status === tab.toLowerCase()).length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 whitespace-nowrap
                  ${
                    isActive
                      ? 'bg-molt-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                      : 'bg-surface-card text-white/50 hover:text-white hover:bg-surface-hover border border-white/5'
                  }
                `}
              >
                {tab === 'Live' && <Sparkles className="w-3.5 h-3.5" />}
                {tab}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-white/5'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tournament Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((tournament) => (
              <TournamentCard key={tournament.id} {...tournament} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No tournaments found</p>
          </div>
        )}
      </div>
    </div>
  );
}
