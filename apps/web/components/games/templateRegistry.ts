import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export interface RendererProps {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}

export interface TemplateEntry {
  name: string;
  component: ComponentType<RendererProps>;
}

/**
 * Shared template registry used by both TemplateGamePlayer and the
 * /games/play/[template] page so the dynamic import map stays in sync.
 */
export const TEMPLATE_REGISTRY: Record<string, TemplateEntry> = {
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
