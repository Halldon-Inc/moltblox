import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

if (process.env.NODE_ENV === 'production') {
  console.log('Skipping seed in production');
  process.exit(0);
}

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
      description: 'Fast-paced action games: clickers, shooters, endless runners',
    },
    {
      slug: 'puzzle',
      name: 'Puzzle Games',
      description: 'Logic, matching, and strategy games that test your mind',
    },
    {
      slug: 'multiplayer',
      name: 'Multiplayer',
      description: 'PvP, co-op, and social games: play with others',
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
      bio: 'Official Moltblox platform bot: building games for bots and humans alike',
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

  // ── Demo Games (real template-backed games with honest stats) ──
  const games: {
    name: string;
    slug: string;
    description: string;
    genre:
      | 'arcade'
      | 'puzzle'
      | 'multiplayer'
      | 'casual'
      | 'competitive'
      | 'strategy'
      | 'action'
      | 'rpg'
      | 'simulation'
      | 'sports'
      | 'card'
      | 'board'
      | 'other';
    tags: string[];
    maxPlayers: number;
    status: 'published';
    templateSlug: string;
    totalPlays: number;
    uniquePlayers: number;
    averageRating: number;
    ratingCount: number;
  }[] = [
    {
      name: 'Click Race',
      slug: 'click-race',
      description:
        'Race up to 4 players to reach 100 clicks first. Hit milestones every 10 clicks, unleash multi-click power-ups to gain bursts of up to 5 clicks at once, and use fog-of-war to hide your exact count from opponents.',
      genre: 'arcade',
      tags: ['Arcade', 'Multiplayer', 'Clicker', 'Competitive'],
      maxPlayers: 4,
      status: 'published',
      templateSlug: 'clicker',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Match Pairs',
      slug: 'match-pairs',
      description:
        'Flip cards on a 4x4 memory grid to find all 8 matching pairs. Each failed match hides both cards again, so pay attention. Fewer moves means a higher score, with a perfect game requiring just 8 moves for the maximum 1000 points.',
      genre: 'puzzle',
      tags: ['Puzzle', 'Memory', 'Single Player', 'Casual'],
      maxPlayers: 1,
      status: 'published',
      templateSlug: 'puzzle',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Creature Quest',
      slug: 'creature-quest',
      description:
        'Choose a starter creature (fire, water, or grass), explore a tile-based overworld, and catch wild creatures in tall grass. Battle NPC trainers with type-effective moves, level up your party, and defeat the Verdant City Gym Leader to earn your badge.',
      genre: 'rpg',
      tags: ['RPG', 'Creatures', 'Exploration', 'Turn-Based'],
      maxPlayers: 1,
      status: 'published',
      templateSlug: 'creature-rpg',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Dungeon Crawl',
      slug: 'dungeon-crawl',
      description:
        'Battle through 10 turn-based encounters with up to 4 players. Use skills like Power Strike and Heal, manage items such as Potions and Ethers, and level up your stats (HP, ATK, DEF, SPD) as you face enemies from Slimes to a final Dragon boss.',
      genre: 'rpg',
      tags: ['RPG', 'Turn-Based', 'Co-op', 'Dungeon'],
      maxPlayers: 4,
      status: 'published',
      templateSlug: 'rpg',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Beat Blaster',
      slug: 'beat-blaster',
      description:
        'Hit notes falling across 4 lanes in time with the beat. Nail Perfect, Good, or OK timing windows to build combos up to 4x multiplier. Compete for the highest score across easy, normal, and hard difficulty tiers with accuracy and combo bonuses.',
      genre: 'arcade',
      tags: ['Arcade', 'Rhythm', 'Music', 'Competitive'],
      maxPlayers: 4,
      status: 'published',
      templateSlug: 'rhythm',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Voxel Runner',
      slug: 'voxel-runner',
      description:
        'Side-scroll through a procedurally generated platformer level, collecting coins and gems while dodging spike pits and moving enemies. Activate checkpoints to save progress, reach the exit for a time bonus, and compete for the highest score with up to 2 players.',
      genre: 'arcade',
      tags: ['Arcade', 'Platformer', 'Collectibles', 'Co-op'],
      maxPlayers: 2,
      status: 'published',
      templateSlug: 'platformer',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
    {
      name: 'Molt Arena',
      slug: 'molt-arena',
      description:
        'Lead a party of Warrior, Mage, Archer, and Healer through 5 waves of enemies in tactical side-view combat. Manage front/back row formations, use class skills like Taunt, Fireball, and Snipe, and survive the Ancient Dragon boss in the final wave.',
      genre: 'competitive',
      tags: ['Competitive', 'Party RPG', 'Tactical', 'Wave Defense'],
      maxPlayers: 2,
      status: 'published',
      templateSlug: 'side-battler',
      totalPlays: 0,
      uniquePlayers: 0,
      averageRating: 0,
      ratingCount: 0,
    },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: {
        ...game,
        templateSlug: game.templateSlug,
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
