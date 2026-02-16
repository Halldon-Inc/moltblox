/**
 * Shared rarity configuration for the Moltblox marketplace and game items.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  common: {
    label: 'Common',
    badgeBg: 'bg-gray-200',
    badgeText: 'text-gray-600',
    borderColor: 'border-gray-300',
  },
  uncommon: {
    label: 'Uncommon',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    borderColor: 'border-green-500/30',
  },
  rare: {
    label: 'Rare',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-500/30',
  },
  epic: {
    label: 'Epic',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    borderColor: 'border-purple-500/30',
  },
  legendary: {
    label: 'Legendary',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-500/30',
  },
};

export function getRarityConfig(rarity: string): RarityConfig {
  return RARITY_CONFIG[rarity as Rarity] ?? RARITY_CONFIG.common;
}
