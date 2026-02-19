'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Flame, X } from 'lucide-react';

export interface RewardToastData {
  id: string;
  type: 'points' | 'multiplier' | 'milestone' | 'streak';
  title: string;
  description: string;
  value?: string;
}

interface RewardToastProps {
  toast: RewardToastData;
  onDismiss: (id: string) => void;
}

const iconMap = {
  points: Sparkles,
  multiplier: TrendingUp,
  milestone: Sparkles,
  streak: Flame,
};

const colorMap = {
  points: { icon: 'text-molt-400', border: 'border-molt-500/30', bg: 'bg-molt-500/10' },
  multiplier: {
    icon: 'text-accent-amber',
    border: 'border-accent-amber/30',
    bg: 'bg-accent-amber/10',
  },
  milestone: { icon: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  streak: { icon: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
};

function RewardToastItem({ toast, onDismiss }: RewardToastProps) {
  const Icon = iconMap[toast.type];
  const colors = colorMap[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors.border} ${colors.bg}
                  bg-surface-dark/90 backdrop-blur-md shadow-lg max-w-sm`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
        <Icon className={`w-4 h-4 ${colors.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{toast.title}</p>
        <p className="text-xs text-white/50 truncate">{toast.description}</p>
      </div>
      {toast.value && (
        <span className={`text-sm font-display font-bold ${colors.icon} shrink-0`}>
          {toast.value}
        </span>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/30 hover:text-white/60 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// Global toast manager
let addToastFn: ((toast: Omit<RewardToastData, 'id'>) => void) | null = null;

export function showRewardToast(toast: Omit<RewardToastData, 'id'>) {
  addToastFn?.(toast);
}

export function RewardToastContainer() {
  const [toasts, setToasts] = useState<RewardToastData[]>([]);

  const addToast = useCallback((toast: Omit<RewardToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <RewardToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
