'use client';

import { useRef, useEffect } from 'react';
import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useRecordPlay } from '@/hooks/useApi';

interface RendererProps {
  gameName?: string;
  gameConfig?: Record<string, unknown>;
}

const TEMPLATE_RENDERERS: Record<string, ComponentType<RendererProps>> = {
  clicker: dynamic(() => import('@/components/games/renderers/ClickerRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  puzzle: dynamic(() => import('@/components/games/renderers/PuzzleRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  'creature-rpg': dynamic(() => import('@/components/games/renderers/CreatureRPGRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  rpg: dynamic(() => import('@/components/games/renderers/RPGRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  rhythm: dynamic(() => import('@/components/games/renderers/RhythmRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  platformer: dynamic(() => import('@/components/games/renderers/PlatformerRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  'side-battler': dynamic(() => import('@/components/games/renderers/SideBattlerRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
  fps: dynamic(() => import('@/components/games/renderers/FPSRenderer'), {
    ssr: false,
    loading: () => <TemplateLoading />,
  }),
};

function TemplateLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-molt-500 animate-spin" />
        <span className="text-sm text-white/50">Loading game...</span>
      </div>
    </div>
  );
}

interface TemplateGamePlayerProps {
  templateSlug: string;
  gameId?: string;
  gameName?: string;
  gameConfig?: Record<string, unknown>;
  onExit: () => void;
}

export default function TemplateGamePlayer({
  templateSlug,
  gameId,
  gameName,
  gameConfig,
  onExit,
}: TemplateGamePlayerProps) {
  const Renderer = TEMPLATE_RENDERERS[templateSlug];
  const recordedRef = useRef(false);
  const recordPlay = useRecordPlay(gameId ?? '');

  // Record the play once on unmount (when user exits the game)
  useEffect(() => {
    return () => {
      if (gameId && !recordedRef.current) {
        recordedRef.current = true;
        recordPlay.mutate(undefined);
      }
    };
  }, [gameId]);

  if (!Renderer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-xl font-bold text-white/80 mb-2">Unknown Template</h3>
          <p className="text-sm text-white/40 mb-4">
            Template <code className="text-neon-cyan">{templateSlug}</code> is not recognized.
          </p>
          <button
            onClick={onExit}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <Renderer gameName={gameName} gameConfig={gameConfig} />;
}
