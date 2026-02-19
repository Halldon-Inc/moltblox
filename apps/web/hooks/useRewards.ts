'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ──

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface TierInfo {
  name: TierName;
  minPoints: number;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

export const TIERS: TierInfo[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    color: '#cd7f32',
    bgColor: 'rgba(205,127,50,0.1)',
    borderColor: 'rgba(205,127,50,0.3)',
    glowColor: 'rgba(205,127,50,0.2)',
  },
  {
    name: 'Silver',
    minPoints: 5_000,
    color: '#c0c0c0',
    bgColor: 'rgba(192,192,192,0.1)',
    borderColor: 'rgba(192,192,192,0.3)',
    glowColor: 'rgba(192,192,192,0.2)',
  },
  {
    name: 'Gold',
    minPoints: 25_000,
    color: '#ffd700',
    bgColor: 'rgba(255,215,0,0.1)',
    borderColor: 'rgba(255,215,0,0.3)',
    glowColor: 'rgba(255,215,0,0.2)',
  },
  {
    name: 'Platinum',
    minPoints: 100_000,
    color: '#a8d8ea',
    bgColor: 'rgba(168,216,234,0.1)',
    borderColor: 'rgba(168,216,234,0.3)',
    glowColor: 'rgba(168,216,234,0.2)',
  },
  {
    name: 'Diamond',
    minPoints: 500_000,
    color: '#b9f2ff',
    bgColor: 'rgba(185,242,255,0.1)',
    borderColor: 'rgba(185,242,255,0.3)',
    glowColor: 'rgba(185,242,255,0.2)',
  },
];

export function getTierForPoints(points: number): TierInfo {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

export function getNextTier(points: number): TierInfo | null {
  const current = getTierForPoints(points);
  const idx = TIERS.findIndex((t) => t.name === current.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export function getTierProgress(points: number): number {
  const current = getTierForPoints(points);
  const next = getNextTier(points);
  if (!next) return 1;
  return (points - current.minPoints) / (next.minPoints - current.minPoints);
}

export type RarityName = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface LootDropData {
  id: string;
  rarity: RarityName;
  pointsEarned: number;
  multiplierBoost?: number;
  badge?: string;
  opened: boolean;
}

export interface RewardsSummary {
  totalPoints: number;
  builderScore: number;
  playerScore: number;
  holderScore: number;
  purchaserScore: number;
  multiplier: number;
  streak: number;
  rank: number;
  totalParticipants: number;
  seasonName: string;
  seasonEndsAt: string;
  estimatedAirdrop: number;
  pendingLootDrops: LootDropData[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  address: string;
  points: number;
  tier: TierName;
  isCurrentUser?: boolean;
}

// ── Category mapping for leaderboard tab -> API param ──

const LEADERBOARD_CATEGORY_MAP: Record<string, string | undefined> = {
  builders: 'builder',
  players: 'player',
  holders: 'holder',
};

// ── Hooks ──

export function useRewardsSummary() {
  return useQuery({
    queryKey: ['rewards-summary'],
    queryFn: async (): Promise<RewardsSummary> => {
      try {
        const [summaryRes, seasonRes] = await Promise.all([
          api.getRewardsSummary(),
          api.getRewardsSeason(),
        ]);

        const d = summaryRes.data;
        const season = seasonRes.data;

        if (!d || !d.seasonId) {
          return getEmptySummary();
        }

        return {
          totalPoints: d.totalPoints ?? 0,
          builderScore: d.builderPoints ?? 0,
          playerScore: d.playerPoints ?? 0,
          holderScore: d.holderPoints ?? 0,
          purchaserScore: d.purchaserPoints ?? 0,
          multiplier: 1.0, // Multiplier computed client-side from streak length
          streak: 0, // Streak not yet tracked server-side; placeholder
          rank: d.rank ?? 0,
          totalParticipants: d.totalParticipants ?? 0,
          seasonName: d.seasonName ?? season?.name ?? 'Pre-Season',
          seasonEndsAt: season?.endDate ?? new Date(Date.now() + 90 * 86400000).toISOString(),
          estimatedAirdrop: Number(d.estimatedTokens ?? '0'),
          pendingLootDrops: [], // Loot drops added in future iteration
        };
      } catch {
        return getEmptySummary();
      }
    },
    staleTime: 30_000,
  });
}

function getEmptySummary(): RewardsSummary {
  return {
    totalPoints: 0,
    builderScore: 0,
    playerScore: 0,
    holderScore: 0,
    purchaserScore: 0,
    multiplier: 1.0,
    streak: 0,
    rank: 0,
    totalParticipants: 0,
    seasonName: 'Pre-Season',
    seasonEndsAt: new Date(Date.now() + 90 * 86400000).toISOString(),
    estimatedAirdrop: 0,
    pendingLootDrops: [],
  };
}

export function useLeaderboard(category: string) {
  return useQuery({
    queryKey: ['leaderboard', category],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      try {
        const apiCategory = LEADERBOARD_CATEGORY_MAP[category];
        const res = await api.getRewardsLeaderboard({
          limit: 50,
          category: apiCategory,
        });

        if (!res.data || res.data.length === 0) return [];

        return res.data.map((entry: any) => ({
          rank: entry.rank,
          username: entry.displayName || 'Unknown',
          address: entry.userId ? `${entry.userId.slice(0, 6)}...${entry.userId.slice(-4)}` : '',
          points: entry.totalPoints ?? 0,
          tier: getTierForPoints(entry.totalPoints ?? 0).name as TierName,
          isCurrentUser: false, // Would need auth context to determine
        }));
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

export function useOpenLootDrop() {
  return {
    openDrop: async (dropId: string): Promise<LootDropData> => {
      // Loot drop opening will be a future server endpoint
      // For now, simulate locally with random results
      await new Promise((r) => setTimeout(r, 2000));
      const roll = Math.random();
      let rarity: RarityName = 'Common';
      if (roll > 0.99) rarity = 'Legendary';
      else if (roll > 0.95) rarity = 'Epic';
      else if (roll > 0.85) rarity = 'Rare';
      else if (roll > 0.6) rarity = 'Uncommon';

      const pointsMap: Record<RarityName, number> = {
        Common: 10 + Math.floor(Math.random() * 40),
        Uncommon: 100 + Math.floor(Math.random() * 400),
        Rare: 1000 + Math.floor(Math.random() * 4000),
        Epic: 10000 + Math.floor(Math.random() * 5000),
        Legendary: 50000 + Math.floor(Math.random() * 10000),
      };

      return {
        id: dropId,
        rarity,
        pointsEarned: pointsMap[rarity],
        multiplierBoost:
          rarity === 'Rare'
            ? 0.1
            : rarity === 'Epic'
              ? 0.2
              : rarity === 'Legendary'
                ? 0.5
                : undefined,
        badge: rarity === 'Legendary' ? 'Early Supporter' : undefined,
        opened: true,
      };
    },
  };
}
