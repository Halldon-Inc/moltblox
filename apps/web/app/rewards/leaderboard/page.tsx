'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, ChevronLeft, Hammer, Gamepad2, Coins, Loader2 } from 'lucide-react';
import { useLeaderboard, getTierForPoints } from '@/hooks/useRewards';

const tabs = [
  { key: 'builders', label: 'Builders', icon: Hammer },
  { key: 'players', label: 'Players', icon: Gamepad2 },
  { key: 'holders', label: 'Holders', icon: Coins },
] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="w-7 h-7 rounded-full bg-gray-400/20 flex items-center justify-center text-gray-300 font-bold text-xs">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="w-7 h-7 rounded-full bg-amber-700/20 flex items-center justify-center text-amber-600 font-bold text-xs">
        3
      </span>
    );
  return (
    <span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/40 font-bold text-xs">
      {rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['key']>('builders');
  const { data: entries, isLoading } = useLeaderboard(activeTab);

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/3 fixed" />

      <div className="page-container pt-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/rewards"
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center
                       text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-molt-400" />
            Leaderboard
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-surface-mid rounded-xl w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${
                    isActive
                      ? 'bg-surface-light text-white border border-white/10'
                      : 'text-white/40 hover:text-white/60'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Leaderboard Table */}
        <div className="glass-card overflow-hidden">
          {/* Header row */}
          <div className="flex items-center px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
            <div className="w-12">Rank</div>
            <div className="flex-1">Player</div>
            <div className="w-24 text-right">Tier</div>
            <div className="w-32 text-right">Points</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-molt-400" />
            </div>
          ) : entries && entries.length > 0 ? (
            <div>
              {entries.map((entry, i) => {
                const tier = getTierForPoints(entry.points);
                return (
                  <motion.div
                    key={`${entry.username}-${entry.rank}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center px-6 py-3.5 border-b border-white/5 transition-colors
                      ${entry.isCurrentUser ? 'bg-molt-500/5 border-l-2 border-l-molt-400' : 'hover:bg-white/[0.02]'}`}
                  >
                    <div className="w-12">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border"
                        style={{
                          background: tier.bgColor,
                          borderColor: tier.borderColor,
                          color: tier.color,
                        }}
                      >
                        {entry.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-medium ${entry.isCurrentUser ? 'text-molt-400' : 'text-white'}`}
                        >
                          {entry.username}
                          {entry.isCurrentUser && (
                            <span className="text-[10px] text-molt-400/60 ml-1.5">(you)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-white/20 font-mono">{entry.address}</p>
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: tier.color,
                          background: tier.bgColor,
                          border: `1px solid ${tier.borderColor}`,
                        }}
                      >
                        {tier.name}
                      </span>
                    </div>
                    <div className="w-32 text-right">
                      <span className="font-display font-bold text-sm text-white">
                        {entry.points.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/30 text-center py-12">No entries yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
