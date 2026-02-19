'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, Zap, Crown } from 'lucide-react';
import { type RarityName, type LootDropData, useOpenLootDrop } from '@/hooks/useRewards';
import { AnimatedCounter } from './AnimatedCounter';
import { showRewardToast } from './RewardToast';

const RARITY_CONFIG: Record<
  RarityName,
  {
    label: string;
    color: string;
    bgGlow: string;
    borderColor: string;
    particleColor: string;
    icon: typeof Gift;
    shakeIntensity: number;
  }
> = {
  Common: {
    label: 'Common',
    color: '#9ca3af',
    bgGlow: 'rgba(156,163,175,0.15)',
    borderColor: 'rgba(156,163,175,0.3)',
    particleColor: '#9ca3af',
    icon: Gift,
    shakeIntensity: 3,
  },
  Uncommon: {
    label: 'Uncommon',
    color: '#4ade80',
    bgGlow: 'rgba(74,222,128,0.15)',
    borderColor: 'rgba(74,222,128,0.3)',
    particleColor: '#4ade80',
    icon: Gift,
    shakeIntensity: 5,
  },
  Rare: {
    label: 'Rare',
    color: '#60a5fa',
    bgGlow: 'rgba(96,165,250,0.15)',
    borderColor: 'rgba(96,165,250,0.3)',
    particleColor: '#60a5fa',
    icon: Sparkles,
    shakeIntensity: 8,
  },
  Epic: {
    label: 'Epic',
    color: '#c084fc',
    bgGlow: 'rgba(192,132,252,0.2)',
    borderColor: 'rgba(192,132,252,0.4)',
    particleColor: '#c084fc',
    icon: Zap,
    shakeIntensity: 12,
  },
  Legendary: {
    label: 'LEGENDARY',
    color: '#fbbf24',
    bgGlow: 'rgba(251,191,36,0.25)',
    borderColor: 'rgba(251,191,36,0.5)',
    particleColor: '#fbbf24',
    icon: Crown,
    shakeIntensity: 16,
  },
};

type RevealPhase = 'idle' | 'shaking' | 'cracking' | 'burst' | 'reveal';

interface LootDropProps {
  drop: LootDropData;
  onOpened?: (result: LootDropData) => void;
}

export function LootDrop({ drop, onOpened }: LootDropProps) {
  const [phase, setPhase] = useState<RevealPhase>(drop.opened ? 'reveal' : 'idle');
  const [result, setResult] = useState<LootDropData | null>(drop.opened ? drop : null);
  const { openDrop } = useOpenLootDrop();

  const handleOpen = useCallback(async () => {
    if (phase !== 'idle') return;

    setPhase('shaking');
    // Start opening in background
    const promise = openDrop(drop.id);

    // Shaking phase (1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    setPhase('cracking');

    // Cracking phase (0.5s)
    await new Promise((r) => setTimeout(r, 500));
    setPhase('burst');

    // Wait for API result
    const opened = await promise;
    setResult(opened);

    // Burst phase (0.4s)
    await new Promise((r) => setTimeout(r, 400));
    setPhase('reveal');

    onOpened?.(opened);

    showRewardToast({
      type: opened.rarity === 'Legendary' ? 'milestone' : 'points',
      title: `${opened.rarity} Loot Drop!`,
      description: `You earned ${opened.pointsEarned.toLocaleString()} points`,
      value: `+${opened.pointsEarned.toLocaleString()}`,
    });
  }, [phase, drop.id, openDrop, onOpened]);

  const config = result ? RARITY_CONFIG[result.rarity] : null;

  // Idle / Shaking / Cracking states
  if (phase !== 'reveal' || !config || !result) {
    return (
      <motion.button
        onClick={handleOpen}
        disabled={phase !== 'idle'}
        className="relative w-32 h-40 rounded-xl bg-gradient-card border border-white/10
                   flex flex-col items-center justify-center gap-2 cursor-pointer
                   hover:border-molt-500/30 hover:shadow-card-hover transition-all
                   disabled:cursor-default"
        animate={
          phase === 'shaking'
            ? {
                x: [0, -4, 4, -6, 6, -3, 3, 0],
                rotate: [0, -2, 2, -3, 3, -1, 1, 0],
                transition: { duration: 0.4, repeat: 3 },
              }
            : phase === 'cracking'
              ? {
                  scale: [1, 1.05, 0.98, 1.08],
                  transition: { duration: 0.5 },
                }
              : phase === 'burst'
                ? {
                    scale: [1.08, 1.3, 0],
                    opacity: [1, 1, 0],
                    transition: { duration: 0.4 },
                  }
                : {}
        }
      >
        {/* Glow behind box during shaking */}
        <AnimatePresence>
          {(phase === 'shaking' || phase === 'cracking') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 rounded-xl"
              style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.2), transparent)' }}
            />
          )}
        </AnimatePresence>

        <Gift className="w-8 h-8 text-white/40" />
        <span className="text-xs text-white/40 uppercase tracking-wider">
          {phase === 'idle' ? 'Tap to Open' : phase === 'shaking' ? 'Opening...' : ''}
        </span>

        {/* Crack lines during cracking phase */}
        {phase === 'cracking' && (
          <>
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              className="absolute top-4 left-1/2 w-[2px] h-8 bg-molt-400/60 origin-top"
              style={{ transform: 'translateX(-50%) rotate(15deg)' }}
            />
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.15 }}
              className="absolute bottom-6 right-6 w-[2px] h-6 bg-molt-400/60 origin-bottom"
              style={{ transform: 'rotate(-20deg)' }}
            />
          </>
        )}
      </motion.button>
    );
  }

  // Reveal state
  const RarityIcon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative w-32 h-40 rounded-xl flex flex-col items-center justify-center gap-1.5 overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${config.bgGlow}, #0a0a0a)`,
        border: `1px solid ${config.borderColor}`,
        boxShadow: `0 0 30px ${config.bgGlow}`,
      }}
    >
      {/* Rarity icon */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <RarityIcon className="w-7 h-7" style={{ color: config.color }} />
      </motion.div>

      {/* Rarity label */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: config.color }}
      >
        {config.label}
      </motion.p>

      {/* Points earned */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 400 }}
      >
        <AnimatedCounter
          value={result.pointsEarned}
          prefix="+"
          className="text-lg font-display font-bold text-white"
        />
        <p className="text-[9px] text-white/40 text-center">points</p>
      </motion.div>

      {/* Multiplier boost */}
      {result.multiplierBoost && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[10px] font-semibold"
          style={{ color: config.color }}
        >
          +{result.multiplierBoost}x multiplier
        </motion.p>
      )}

      {/* Badge */}
      {result.badge && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-[9px] text-accent-amber font-semibold"
        >
          {result.badge}
        </motion.p>
      )}
    </motion.div>
  );
}
