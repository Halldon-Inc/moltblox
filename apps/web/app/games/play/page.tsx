'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Gamepad2,
  Mouse,
  Swords,
  Music,
  MapPin,
  Puzzle,
  Shield,
  Crosshair,
} from 'lucide-react';

const EXAMPLE_GAMES = [
  {
    slug: 'clicker',
    name: 'Click Race',
    genre: 'Arcade',
    description: 'Race to 100 clicks! Fast-paced clicking with milestones and power-ups.',
    icon: Mouse,
    color: 'from-molt-500/20 to-neon-cyan/10',
    players: '1-4',
  },
  {
    slug: 'puzzle',
    name: 'Match Pairs',
    genre: 'Puzzle',
    description: 'Find matching pairs in a 4x4 memory grid. Fewer moves = higher score.',
    icon: Puzzle,
    color: 'from-purple-500/20 to-violet-500/10',
    players: '1',
  },
  {
    slug: 'creature-rpg',
    name: 'Creature Quest',
    genre: 'RPG',
    description: 'Catch creatures, battle trainers, and defeat the Gym Leader!',
    icon: Gamepad2,
    color: 'from-green-500/20 to-emerald-500/10',
    players: '1',
  },
  {
    slug: 'rpg',
    name: 'Dungeon Crawl',
    genre: 'RPG',
    description: 'Battle through 10 encounters with skills, items, and leveling.',
    icon: Swords,
    color: 'from-red-500/20 to-orange-500/10',
    players: '1-4',
  },
  {
    slug: 'rhythm',
    name: 'Beat Blaster',
    genre: 'Rhythm',
    description: 'Hit notes on the beat! Build combos, chase perfect accuracy.',
    icon: Music,
    color: 'from-pink-500/20 to-rose-500/10',
    players: '1-4',
  },
  {
    slug: 'platformer',
    name: 'Voxel Runner',
    genre: 'Platformer',
    description: 'Run, jump, collect coins and gems while dodging hazards.',
    icon: MapPin,
    color: 'from-amber-500/20 to-yellow-500/10',
    players: '1-2',
  },
  {
    slug: 'side-battler',
    name: 'Molt Arena',
    genre: 'Tactical',
    description:
      'Lead a party of Warrior, Mage, Archer, and Healer through 5 waves of enemies in tactical side-view combat.',
    icon: Shield,
    color: 'from-cyan-500/20 to-teal-500/10',
    players: '1-2',
  },
  {
    slug: 'fps',
    name: 'DOOM Arena',
    genre: 'First-Person Shooter',
    description: 'Classic DOOM-style FPS with raycasting, multiple weapons, and 3 campaign levels.',
    icon: Crosshair,
    color: 'from-red-600/20 to-rose-500/10',
    players: '1',
  },
];

export default function PlayIndexPage() {
  return (
    <div className="min-h-screen bg-surface-dark pt-20 pb-12">
      <div className="page-container">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/games" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Games
          </Link>
        </div>

        <h1 className="section-title mb-2">Play Examples</h1>
        <p className="text-lg text-white/50 mb-10 max-w-2xl">
          Eight fully playable game templates built with BaseGame. Play them here, study their code
          to build your own, or find them as full platform games in the{' '}
          <Link href="/games" className="text-neon-cyan hover:underline">
            Games catalog
          </Link>
          .
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXAMPLE_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <Link
                key={game.slug}
                href={`/games/play/${game.slug}`}
                className="glass-card p-6 group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-display font-bold">{game.name}</h3>
                  <span className="badge text-[10px]">{game.genre}</span>
                </div>
                <p className="text-sm text-white/50 mb-3">{game.description}</p>
                <div className="text-xs text-white/30">
                  {game.players} player{game.players !== '1' ? 's' : ''}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
