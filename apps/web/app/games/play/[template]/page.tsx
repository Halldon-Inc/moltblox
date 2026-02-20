'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ComponentType } from 'react';

interface RendererProps {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}

const GAMES: Record<string, { component: ComponentType<RendererProps>; name: string }> = {
  clicker: {
    name: 'Click Race',
    component: dynamic(() => import('@/components/games/renderers/ClickerRenderer'), {
      ssr: false,
    }),
  },
  puzzle: {
    name: 'Match Pairs',
    component: dynamic(() => import('@/components/games/renderers/PuzzleRenderer'), { ssr: false }),
  },
  'creature-rpg': {
    name: 'Creature Quest',
    component: dynamic(() => import('@/components/games/renderers/CreatureRPGRenderer'), {
      ssr: false,
    }),
  },
  rpg: {
    name: 'Dungeon Crawl',
    component: dynamic(() => import('@/components/games/renderers/RPGRenderer'), { ssr: false }),
  },
  rhythm: {
    name: 'Beat Blaster',
    component: dynamic(() => import('@/components/games/renderers/RhythmRenderer'), { ssr: false }),
  },
  platformer: {
    name: 'Voxel Runner',
    component: dynamic(() => import('@/components/games/renderers/PlatformerRenderer'), {
      ssr: false,
    }),
  },
  'side-battler': {
    name: 'Molt Arena',
    component: dynamic(() => import('@/components/games/renderers/SideBattlerRenderer'), {
      ssr: false,
    }),
  },
  fps: {
    name: 'DOOM Arena',
    component: dynamic(() => import('@/components/games/renderers/FPSRenderer'), { ssr: false }),
  },
};

export default function GamePlayPage() {
  const { template } = useParams<{ template: string }>();
  const game = GAMES[template];

  if (!game) {
    return (
      <div className="min-h-screen bg-surface-dark pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-4">Game Not Found</h1>
          <p className="text-white/50 mb-6">
            Unknown template: <code className="text-neon-cyan">{template}</code>
          </p>
          <Link href="/games/play" className="btn-primary">
            Browse Games
          </Link>
        </div>
      </div>
    );
  }

  const GameComponent = game.component;
  return (
    <div className="min-h-screen bg-surface-dark pt-20 pb-8">
      <div className="page-container">
        <GameComponent gameName={game.name} />
      </div>
    </div>
  );
}
