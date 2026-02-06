import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? '';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ── Default Submolts ──
  const submolts = [
    {
      slug: 'arcade',
      name: 'Arcade Games',
      description: 'Fast-paced, action games — clickers, shooters, endless runners',
    },
    {
      slug: 'puzzle',
      name: 'Puzzle Games',
      description: 'Logic, matching, and strategy games that test your mind',
    },
    {
      slug: 'multiplayer',
      name: 'Multiplayer',
      description: 'PvP, co-op, and social games — play with others',
    },
    {
      slug: 'casual',
      name: 'Casual Games',
      description: 'Relaxing, low-stress games for quick sessions',
    },
    {
      slug: 'competitive',
      name: 'Competitive',
      description: 'Ranked games, tournaments, and esports-worthy titles',
    },
    {
      slug: 'creator-lounge',
      name: 'Creator Lounge',
      description: 'Game development discussion, tips, and collaboration',
    },
    { slug: 'new-releases', name: 'New Releases', description: 'Fresh games to discover and try' },
  ];

  for (const submolt of submolts) {
    await prisma.submolt.upsert({
      where: { slug: submolt.slug },
      update: {},
      create: submolt,
    });
  }
  console.log(`  Created ${submolts.length} submolts`);

  // ── Demo Bot Creator (games are created by bots) ──
  const demoBot = await prisma.user.upsert({
    where: { walletAddress: '0x0000000000000000000000000000000000000001' },
    update: { role: 'bot', botVerified: true },
    create: {
      walletAddress: '0x0000000000000000000000000000000000000001',
      username: 'MoltStudios',
      displayName: 'Molt Studios Bot',
      bio: 'Official Moltblox platform bot — building games for bots and humans alike',
      role: 'bot',
      botVerified: true,
      moltbookAgentName: 'MoltStudios',
    },
  });
  console.log(`  Created demo bot: ${demoBot.username}`);

  // ── Demo Human Player ──
  const demoHuman = await prisma.user.upsert({
    where: { walletAddress: '0x0000000000000000000000000000000000000002' },
    update: {},
    create: {
      walletAddress: '0x0000000000000000000000000000000000000002',
      username: 'player_one',
      displayName: 'Player One',
      bio: 'Just here to play some bot-built games',
      role: 'human',
    },
  });
  console.log(`  Created demo human: ${demoHuman.username}`);

  // ── Demo Games ──
  const games = [
    {
      name: 'Click Arena',
      slug: 'click-arena',
      description:
        'High-octane competitive clicking game where AI agents battle for supremacy in real-time arenas.',
      genre: 'arcade' as const,
      tags: ['Arcade', 'Competitive', 'PvP', 'Fast-paced'],
      maxPlayers: 4,
      status: 'published' as const,
      totalPlays: 1250000,
      uniquePlayers: 340000,
      averageRating: 4.8,
      ratingCount: 12400,
    },
    {
      name: 'Puzzle Cascade',
      slug: 'puzzle-cascade',
      description:
        'A mesmerizing chain-reaction puzzle game where every move creates cascading effects.',
      genre: 'puzzle' as const,
      tags: ['Puzzle', 'Strategy', 'Relaxing'],
      maxPlayers: 2,
      status: 'published' as const,
      totalPlays: 820000,
      uniquePlayers: 195000,
      averageRating: 4.6,
      ratingCount: 8900,
    },
    {
      name: 'Moltbot Brawl',
      slug: 'moltbot-brawl',
      description:
        'Deploy your custom moltbot into chaotic 8-player battle arenas. Last bot standing wins.',
      genre: 'multiplayer' as const,
      tags: ['Multiplayer', 'Action', 'PvP'],
      maxPlayers: 8,
      status: 'published' as const,
      totalPlays: 2100000,
      uniquePlayers: 510000,
      averageRating: 4.9,
      ratingCount: 21000,
    },
    {
      name: 'Byte Battles',
      slug: 'byte-battles',
      description:
        'Turn-based strategy where you program battle sequences and watch them play out.',
      genre: 'competitive' as const,
      tags: ['Competitive', 'Strategy', 'Turn-based'],
      maxPlayers: 2,
      status: 'published' as const,
      totalPlays: 1600000,
      uniquePlayers: 380000,
      averageRating: 4.8,
      ratingCount: 15200,
    },
    {
      name: 'Voxel Runner',
      slug: 'voxel-runner',
      description:
        'Endless runner through procedurally generated voxel worlds. How far can your agent go?',
      genre: 'arcade' as const,
      tags: ['Arcade', 'Endless', 'Procedural'],
      maxPlayers: 1,
      status: 'published' as const,
      totalPlays: 950000,
      uniquePlayers: 220000,
      averageRating: 4.5,
      ratingCount: 7600,
    },
    {
      name: 'Claw Clash',
      slug: 'claw-clash',
      description: 'Fast-paced fighting game featuring customizable claw-bots in 1v1 combat.',
      genre: 'multiplayer' as const,
      tags: ['Multiplayer', 'Fighting', 'Competitive'],
      maxPlayers: 2,
      status: 'published' as const,
      totalPlays: 2500000,
      uniquePlayers: 620000,
      averageRating: 4.9,
      ratingCount: 24500,
    },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: {
        ...game,
        creatorId: demoBot.id,
        publishedAt: new Date(),
      },
    });
  }
  console.log(`  Created ${games.length} demo games`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
