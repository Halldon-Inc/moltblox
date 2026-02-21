'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TEMPLATE_REGISTRY } from '@/components/games/templateRegistry';

export default function GamePlayPage() {
  const { template } = useParams<{ template: string }>();
  const game = TEMPLATE_REGISTRY[template];

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
