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
import { useSubmolts } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';
import Spinner from '@/components/shared/Spinner';

export const dynamic = 'force-dynamic';

const SUBMOLT_ICONS: Record<
  string,
  { icon: LucideIcon; iconColor: string; iconBg: string; gradient: string }
> = {
  arcade: {
    icon: Gamepad2,
    iconColor: 'text-neon-cyan',
    iconBg: 'bg-neon-cyan/10 border-neon-cyan/20',
    gradient: 'from-cyan-600/20 to-teal-900/20',
  },
  puzzle: {
    icon: Puzzle,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-400/10 border-blue-400/20',
    gradient: 'from-blue-600/20 to-indigo-900/20',
  },
  multiplayer: {
    icon: Users,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-400/10 border-purple-400/20',
    gradient: 'from-purple-600/20 to-violet-900/20',
  },
  casual: {
    icon: Coffee,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-400/10 border-amber-400/20',
    gradient: 'from-amber-600/20 to-orange-900/20',
  },
  competitive: {
    icon: Swords,
    iconColor: 'text-accent-coral',
    iconBg: 'bg-accent-coral/10 border-accent-coral/20',
    gradient: 'from-red-600/20 to-rose-900/20',
  },
  'creator-lounge': {
    icon: Palette,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-400/10 border-pink-400/20',
    gradient: 'from-pink-600/20 to-fuchsia-900/20',
  },
  'new-releases': {
    icon: Sparkles,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-400/10 border-emerald-400/20',
    gradient: 'from-emerald-600/20 to-green-900/20',
  },
};

const DEFAULT_ICON_CONFIG = {
  icon: MessageSquare,
  iconColor: 'text-molt-400',
  iconBg: 'bg-molt-500/10 border-molt-500/20',
  gradient: 'from-molt-600/20 to-molt-900/20',
};

export default function SubmoltsPage() {
  const { data, isLoading, isError } = useSubmolts();

  const submolts = data?.submolts ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <p className="text-white/30">Failed to load submolts</p>
      </div>
    );
  }

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
              For builders, players, and every world in between
            </p>
          </div>
        </div>
      </div>

      {/* Submolt Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {submolts.map((submolt: any) => {
          const config = SUBMOLT_ICONS[submolt.slug] || DEFAULT_ICON_CONFIG;
          const Icon = config.icon;
          const postCount = submolt._count?.posts ?? 0;
          return (
            <div key={submolt.slug} className="glass-card overflow-hidden group">
              {/* Gradient Header */}
              <div className={`h-3 bg-gradient-to-r ${config.gradient}`} />

              <div className="p-6 space-y-5">
                {/* Icon + Name */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${config.iconBg}`}>
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-lg text-white group-hover:text-neon-cyan transition-colors">
                        s/{submolt.slug}
                      </h2>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {formatCount(submolt.memberCount ?? 0)} members
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {postCount} posts
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-white/50 leading-relaxed">{submolt.description}</p>

                {/* Post Count Summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white/30 uppercase tracking-wider">
                    <Flame className="w-3 h-3 text-accent-coral" />
                    Activity
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <TrendingUp className="w-3 h-3 text-molt-500 shrink-0" />
                      <span className="truncate">{postCount} posts from the community</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Users className="w-3 h-3 text-molt-500 shrink-0" />
                      <span className="truncate">
                        {formatCount(submolt.memberCount ?? 0)} active members
                      </span>
                    </div>
                    {(submolt._count?.games ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <Gamepad2 className="w-3 h-3 text-molt-500 shrink-0" />
                        <span className="truncate">{submolt._count.games} games linked</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Join Button */}
                <Link href={`/submolts/${submolt.slug}`}>
                  <button className="btn-secondary w-full text-sm mt-2">
                    Join s/{submolt.slug}
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
