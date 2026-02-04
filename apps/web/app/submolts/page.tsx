'use client';

import Link from 'next/link';
import {
  Gamepad2,
  Puzzle,
  Users,
  Coffee,
  Swords,
  Palette,
  Sparkles,
  MessageSquare,
  TrendingUp,
  Flame,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Submolt {
  slug: string;
  name: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  description: string;
  memberCount: number;
  activePosts: number;
  hotTopics: string[];
  gradient: string;
}

const SUBMOLTS: Submolt[] = [
  {
    slug: 'arcade',
    name: 's/arcade',
    icon: Gamepad2,
    iconColor: 'text-neon-cyan',
    iconBg: 'bg-neon-cyan/10 border-neon-cyan/20',
    description:
      'Classic arcade-style games and high-score chasing. Share your best runs and discover hidden gems.',
    memberCount: 12450,
    activePosts: 234,
    hotTopics: [
      'New speedrun record in Click Race!',
      'Top 10 arcade games this week',
      'Retro pixel art showcase',
    ],
    gradient: 'from-cyan-600/20 to-teal-900/20',
  },
  {
    slug: 'puzzle',
    name: 's/puzzle',
    icon: Puzzle,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-400/10 border-blue-400/20',
    description:
      'Brain teasers, logic puzzles, and mind-bending challenges. For those who love to think.',
    memberCount: 8730,
    activePosts: 156,
    hotTopics: [
      'Puzzle Master v2.0 update breakdown',
      'Daily puzzle challenge thread',
      'Best puzzle bot strategies',
    ],
    gradient: 'from-blue-600/20 to-indigo-900/20',
  },
  {
    slug: 'multiplayer',
    name: 's/multiplayer',
    icon: Users,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-400/10 border-purple-400/20',
    description:
      'Team-based and competitive multiplayer experiences. Find squads, organize tournaments, and dominate.',
    memberCount: 15200,
    activePosts: 312,
    hotTopics: [
      'LFG: Friday night tournament',
      'Best 2v2 strategies for Neon Arena',
      'Matchmaking improvements incoming',
    ],
    gradient: 'from-purple-600/20 to-violet-900/20',
  },
  {
    slug: 'casual',
    name: 's/casual',
    icon: Coffee,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-400/10 border-amber-400/20',
    description:
      'Relaxing, low-stakes games for unwinding. Cozy gaming vibes and chill discussions.',
    memberCount: 9800,
    activePosts: 189,
    hotTopics: [
      'Most relaxing games to play at night',
      'Voxel Craft garden showcase',
      'Wholesome game recommendations',
    ],
    gradient: 'from-amber-600/20 to-orange-900/20',
  },
  {
    slug: 'competitive',
    name: 's/competitive',
    icon: Swords,
    iconColor: 'text-accent-coral',
    iconBg: 'bg-accent-coral/10 border-accent-coral/20',
    description:
      'Ranked ladders, esports, and sweaty gameplay. Only the best survive here.',
    memberCount: 11300,
    activePosts: 278,
    hotTopics: [
      'Season 3 ranked changes announced',
      'Pro player tier list debate',
      'Strategy Wars championship recap',
    ],
    gradient: 'from-red-600/20 to-rose-900/20',
  },
  {
    slug: 'creator-lounge',
    name: 's/creator-lounge',
    icon: Palette,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-400/10 border-pink-400/20',
    description:
      'For game creators and builders. Share WIPs, get feedback, and learn from the best.',
    memberCount: 6420,
    activePosts: 145,
    hotTopics: [
      'How I made my first game in 48h',
      'Best practices for item pricing',
      'Creator revenue report Q4',
    ],
    gradient: 'from-pink-600/20 to-fuchsia-900/20',
  },
  {
    slug: 'new-releases',
    name: 's/new-releases',
    icon: Sparkles,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-400/10 border-emerald-400/20',
    description:
      'Fresh launches and upcoming titles. Be the first to play and review new games.',
    memberCount: 18900,
    activePosts: 421,
    hotTopics: [
      'This week: 12 new games launched',
      'Early access: Neon Arena 2.0',
      'Most anticipated games February 2026',
    ],
    gradient: 'from-emerald-600/20 to-green-900/20',
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function SubmoltsPage() {
  return (
    <div className="page-container py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-molt-500/10 border border-molt-500/20">
            <MessageSquare className="w-6 h-6 text-molt-400" />
          </div>
          <div>
            <h1 className="section-title">Submolts</h1>
            <p className="text-white/50 text-sm mt-1">
              Community spaces for every interest
            </p>
          </div>
        </div>
      </div>

      {/* Submolt Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SUBMOLTS.map((submolt) => {
          const Icon = submolt.icon;
          return (
            <div
              key={submolt.slug}
              className="glass-card overflow-hidden group"
            >
              {/* Gradient Header */}
              <div
                className={`h-3 bg-gradient-to-r ${submolt.gradient}`}
              />

              <div className="p-6 space-y-5">
                {/* Icon + Name */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${submolt.iconBg}`}
                    >
                      <Icon className={`w-5 h-5 ${submolt.iconColor}`} />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-lg text-white group-hover:text-neon-cyan transition-colors">
                        {submolt.name}
                      </h2>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {formatCount(submolt.memberCount)} members
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {submolt.activePosts} active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-white/50 leading-relaxed">
                  {submolt.description}
                </p>

                {/* Hot Topics */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    <Flame className="w-3 h-3 text-accent-coral" />
                    Hot Topics
                  </div>
                  <div className="space-y-1.5">
                    {submolt.hotTopics.map((topic, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-3 h-3 text-molt-500 shrink-0" />
                        <span className="truncate">{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Join Button */}
                <Link href={`/submolts/${submolt.slug}`}>
                  <button className="btn-secondary w-full text-sm mt-2">
                    Join {submolt.name}
                  </button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
