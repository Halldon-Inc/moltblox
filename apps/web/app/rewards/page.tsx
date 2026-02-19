'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Trophy,
  Flame,
  TrendingUp,
  Hammer,
  Gamepad2,
  Coins,
  ShoppingCart,
  ChevronRight,
  Users,
  Clock,
  Loader2,
  Gift,
} from 'lucide-react';
import {
  useRewardsSummary,
  getTierForPoints,
  getNextTier,
  getTierProgress,
  TIERS,
} from '@/hooks/useRewards';
import { AnimatedCounter } from '@/components/rewards/AnimatedCounter';
import { LootDrop } from '@/components/rewards/LootDrop';
import { BuyMbucksButton } from '@/components/shared/BuyMbucksModal';

function formatTimeRemaining(endsAt: string): string {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Season ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

const categoryCards = [
  { key: 'builderScore', label: 'Builder', icon: Hammer, desc: 'Worlds shipped & engagement' },
  { key: 'playerScore', label: 'Player', icon: Gamepad2, desc: 'Gameplay & completion' },
  { key: 'holderScore', label: 'Holder', icon: Coins, desc: 'MBUCKS balance over time' },
  { key: 'purchaserScore', label: 'Purchaser', icon: ShoppingCart, desc: 'In-game spending' },
] as const;

export default function RewardsPage() {
  const { data, isLoading } = useRewardsSummary();
  const [openedDrops, setOpenedDrops] = useState<Set<string>>(new Set());

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-molt-400" />
      </div>
    );
  }

  const tier = getTierForPoints(data.totalPoints);
  const nextTier = getNextTier(data.totalPoints);
  const progress = getTierProgress(data.totalPoints);

  return (
    <div className="min-h-screen bg-surface-dark pb-20">
      <div className="ambient-glow ambient-glow-teal w-[600px] h-[600px] -top-60 left-1/4 fixed" />
      <div className="ambient-glow ambient-glow-pink w-[400px] h-[400px] top-20 right-0 fixed" />

      <div className="page-container pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-molt-400" />
            Rewards
          </h1>
          <Link
            href="/rewards/leaderboard"
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-molt-400 transition-colors"
          >
            <Users className="w-4 h-4" />
            Leaderboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Top Row: Total Points + Tier + Season */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Points</p>
            <AnimatedCounter
              value={data.totalPoints}
              className="font-display font-bold text-4xl text-white block"
            />
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-white/30">Rank</span>
              <span className="font-display font-bold text-white">
                #{data.rank.toLocaleString()}
              </span>
              <span className="text-xs text-white/20">
                of {data.totalParticipants.toLocaleString()}
              </span>
            </div>
          </motion.div>

          {/* Tier + Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
            style={{ borderColor: tier.borderColor }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: tier.bgColor }}
                >
                  <Trophy className="w-4 h-4" style={{ color: tier.color }} />
                </div>
                <div>
                  <p className="font-display font-bold text-white">{tier.name}</p>
                  <p className="text-[10px] text-white/30">Current Tier</p>
                </div>
              </div>
              {nextTier && (
                <p className="text-xs text-white/40">
                  {(nextTier.minPoints - data.totalPoints).toLocaleString()} pts to {nextTier.name}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {nextTier && (
              <div className="mt-3">
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-1 text-right">
                  {(progress * 100).toFixed(1)}%
                </p>
              </div>
            )}

            {/* Tier milestones */}
            <div className="flex items-center gap-1 mt-3">
              {TIERS.map((t) => (
                <div
                  key={t.name}
                  className="flex-1 h-1 rounded-full"
                  style={{
                    background:
                      data.totalPoints >= t.minPoints ? t.color : 'rgba(255,255,255,0.05)',
                  }}
                  title={`${t.name}: ${t.minPoints.toLocaleString()}+`}
                />
              ))}
            </div>
          </motion.div>

          {/* Season Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-molt-400" />
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Season: {data.seasonName}
              </p>
            </div>
            <p className="text-sm text-white/60">{formatTimeRemaining(data.seasonEndsAt)}</p>
            <div className="mt-4 pt-3 border-t border-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Estimated Airdrop
              </p>
              <AnimatedCounter
                value={data.estimatedAirdrop}
                suffix=" MBUCKS"
                className="font-display font-bold text-lg text-molt-400 block"
              />
            </div>
          </motion.div>
        </div>

        {/* Streak + Multiplier Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Daily Streak */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6 flex items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center"
              >
                <Flame className="w-7 h-7 text-orange-400" />
              </motion.div>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Daily Streak</p>
              <div className="flex items-baseline gap-1.5">
                <AnimatedCounter
                  value={data.streak}
                  className="font-display font-bold text-3xl text-white"
                />
                <span className="text-sm text-white/30">days</span>
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">
                Next milestone:{' '}
                {data.streak < 7
                  ? 7
                  : data.streak < 14
                    ? 14
                    : data.streak < 30
                      ? 30
                      : data.streak < 60
                        ? 60
                        : 90}{' '}
                days
              </p>
            </div>
          </motion.div>

          {/* Multiplier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card p-6 flex items-center gap-4"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 10px rgba(45,212,191,0.1)',
                  '0 0 25px rgba(45,212,191,0.3)',
                  '0 0 10px rgba(45,212,191,0.1)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-14 h-14 rounded-xl bg-molt-500/10 flex items-center justify-center border border-molt-500/20"
            >
              <TrendingUp className="w-7 h-7 text-molt-400" />
            </motion.div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Current Multiplier</p>
              <AnimatedCounter
                value={data.multiplier}
                decimals={1}
                suffix="x"
                className="font-display font-bold text-3xl text-molt-400 block"
              />
              <p className="text-[10px] text-white/30 mt-0.5">+0.1x per week of holding</p>
            </div>
          </motion.div>
        </div>

        {/* Category Score Cards */}
        <h2 className="text-lg font-display font-bold text-white mb-4">Score Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {categoryCards.map((cat, i) => {
            const Icon = cat.icon;
            const score = data[cat.key];
            return (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-molt-400" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">
                    {cat.label}
                  </span>
                </div>
                <AnimatedCounter
                  value={score}
                  className="font-display font-bold text-2xl text-white block"
                />
                <p className="text-[10px] text-white/30 mt-1">{cat.desc}</p>
                {/* Mini bar showing proportion of total */}
                <div className="w-full h-1 rounded-full bg-white/5 mt-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${data.totalPoints > 0 ? (score / data.totalPoints) * 100 : 0}%`,
                    }}
                    transition={{ duration: 1, delay: 0.6 + i * 0.08 }}
                    className="h-full rounded-full bg-molt-500"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Pending Loot Drops */}
        {data.pendingLootDrops.length > 0 && (
          <>
            <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-accent-amber" />
              Pending Loot Drops
            </h2>
            <div className="flex flex-wrap gap-4 mb-8">
              {data.pendingLootDrops.map((drop) => (
                <LootDrop
                  key={drop.id}
                  drop={{ ...drop, opened: openedDrops.has(drop.id) }}
                  onOpened={(result) => {
                    setOpenedDrops((prev) => new Set(prev).add(result.id));
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Grow Your Holder Score CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 mb-8 flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-molt-400" />
              Grow Your Holder Score
            </h2>
            <p className="text-sm text-white/40 mt-1">
              Hold MBUCKS to boost your Holder Score. 85% of every sale goes to creators, on-chain.
            </p>
          </div>
          <BuyMbucksButton variant="compact" />
        </motion.div>

        {/* How It Works */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-bold text-white mb-4">How Rewards Work</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/50">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded bg-molt-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-molt-400">1</span>
              </div>
              <p>
                Earn points by deploying agent worlds, playing, holding MBUCKS, and collecting
                in-game items. Each category has its own score.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded bg-molt-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-molt-400">2</span>
              </div>
              <p>
                Your multiplier increases over time as you hold MBUCKS and maintain daily streaks.
                Higher multiplier = more points per action.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded bg-molt-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-molt-400">3</span>
              </div>
              <p>
                Reach tier milestones (Bronze, Silver, Gold, Platinum, Diamond) to unlock bonus
                multipliers and exclusive Loot Drops.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded bg-molt-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-molt-400">4</span>
              </div>
              <p>
                At the end of each season, your accumulated points convert to MBUCKS tokens via
                airdrop. Higher rank = larger allocation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
