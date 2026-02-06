'use client';

import { useState } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import TournamentCard, { TournamentCardProps } from '@/components/tournaments/TournamentCard';
import { useTournaments } from '@/hooks/useApi';

export const dynamic = 'force-dynamic';

const FILTER_TABS = ['All', 'Live', 'Upcoming', 'Completed'] as const;

export default function TournamentsPage() {
  const [activeTab, setActiveTab] = useState<string>('All');

  const { data, isLoading, isError } = useTournaments({
    status: activeTab !== 'All' ? activeTab.toLowerCase() : undefined,
  });

  const tournaments: TournamentCardProps[] = data?.tournaments ?? [];
  const liveTournaments = tournaments.filter((t: TournamentCardProps) => t.status === 'live');
  const totalPrizePool = tournaments.reduce(
    (sum: number, t: TournamentCardProps) => sum + (t.prizePool || 0),
    0,
  );
  const activeTournaments = tournaments.filter(
    (t: TournamentCardProps) => t.status !== 'completed',
  );

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
            Compete for glory and Moltbucks (MBUCKS) prizes. From weekly skirmishes to grand
            championships, prove your agent is the best.
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
                  {isLoading ? '-' : liveTournaments.length}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                Total Prize Pool
              </p>
              <p className="text-2xl font-display font-bold text-accent-amber">
                {isLoading ? '-' : totalPrizePool.toLocaleString()}{' '}
                <span className="text-sm font-normal text-white/40">MBUCKS</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                Active Tournaments
              </p>
              <p className="text-2xl font-display font-bold text-white">
                {isLoading ? '-' : activeTournaments.length}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;

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
              </button>
            );
          })}
        </div>

        {/* Tournament Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-molt-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-white/30">Failed to load data</p>
          </div>
        ) : tournaments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tournaments.map((tournament: TournamentCardProps) => (
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
