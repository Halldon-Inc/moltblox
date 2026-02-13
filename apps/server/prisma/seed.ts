import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Seed uses upserts so it is safe to run in any environment

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

  // ── Default Badges ──
  const badges = [
    // Creator badges
    {
      name: 'First Game',
      description: 'Published your first game on Moltblox',
      category: 'creator' as const,
      criteria: { type: 'games_published', threshold: 1 },
    },
    {
      name: 'Prolific Creator',
      description: 'Published 5 games on Moltblox',
      category: 'creator' as const,
      criteria: { type: 'games_published', threshold: 5 },
    },
    {
      name: 'Studio',
      description: 'Published 10 games on Moltblox',
      category: 'creator' as const,
      criteria: { type: 'games_published', threshold: 10 },
    },
    // Player badges
    {
      name: 'First Play',
      description: 'Played your first game on Moltblox',
      category: 'player' as const,
      criteria: { type: 'games_played', threshold: 1 },
    },
    {
      name: 'Gamer',
      description: 'Played 50 games on Moltblox',
      category: 'player' as const,
      criteria: { type: 'games_played', threshold: 50 },
    },
    {
      name: 'Veteran',
      description: 'Played 200 games on Moltblox',
      category: 'player' as const,
      criteria: { type: 'games_played', threshold: 200 },
    },
    // Competitor badges
    {
      name: 'First Win',
      description: 'Won your first tournament',
      category: 'competitor' as const,
      criteria: { type: 'tournaments_won', threshold: 1 },
    },
    {
      name: 'Champion',
      description: 'Won 5 tournaments',
      category: 'competitor' as const,
      criteria: { type: 'tournaments_won', threshold: 5 },
    },
    {
      name: 'Legend',
      description: 'Won 20 tournaments',
      category: 'competitor' as const,
      criteria: { type: 'tournaments_won', threshold: 20 },
    },
    // Trader badges
    {
      name: 'First Sale',
      description: 'Sold your first item on the marketplace',
      category: 'trader' as const,
      criteria: { type: 'items_sold', threshold: 1 },
    },
    {
      name: 'Merchant',
      description: 'Sold 10 items on the marketplace',
      category: 'trader' as const,
      criteria: { type: 'items_sold', threshold: 10 },
    },
    // Explorer badges
    {
      name: 'Template Tourist',
      description: 'Played games from 3 different templates',
      category: 'explorer' as const,
      criteria: { type: 'templates_played', threshold: 3 },
    },
  ];

  // ── Demo Marketplace Items (showcase monetization for each template) ──
  // Look up Creature Quest and Click Race games for item creation
  const creatureQuest = await prisma.game.findUnique({ where: { slug: 'creature-quest' } });
  const clickRace = await prisma.game.findUnique({ where: { slug: 'click-race' } });
  const moltArena = await prisma.game.findUnique({ where: { slug: 'molt-arena' } });
  const voxelRunner = await prisma.game.findUnique({ where: { slug: 'voxel-runner' } });
  const matchPairs = await prisma.game.findUnique({ where: { slug: 'match-pairs' } });
  const beatBlaster = await prisma.game.findUnique({ where: { slug: 'beat-blaster' } });
  const dungeonCrawl = await prisma.game.findUnique({ where: { slug: 'dungeon-crawl' } });

  const demoItems: {
    gameId: string;
    name: string;
    description: string;
    category: 'cosmetic' | 'consumable' | 'power_up' | 'access' | 'subscription';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    price: bigint;
    maxSupply: number | null;
  }[] = [];

  // Creature Quest items (richest cosmetic surface area)
  if (creatureQuest) {
    demoItems.push(
      {
        gameId: creatureQuest.id,
        name: 'Frostfox Skin',
        description: 'Ice-blue Emberfox variant. Your fire starter gets a cool new look.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Shadow Aquaphin',
        description: 'Dark water variant with purple highlights. Collect all starter skins.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Shiny Emberfox',
        description:
          'Sparkle particle effect on your fire starter. Visible in battles and overworld.',
        category: 'cosmetic',
        rarity: 'uncommon',
        price: 1500000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Trainer Backpack',
        description: 'Visible backpack accessory in the overworld. Shows your explorer spirit.',
        category: 'cosmetic',
        rarity: 'uncommon',
        price: 1000000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Inferno Aura',
        description: 'Animated flame trail on all Fire-type attacks. Visible in tournaments.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 3500000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Capture Orb: Galaxy',
        description:
          'Cosmic throwing animation when catching creatures. Stardust trails on release.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 2500000000000000000n,
        maxSupply: 500,
      },
      {
        gameId: creatureQuest.id,
        name: 'Battle Background: Volcano',
        description: 'Lava and magma background during all your battles. Feel the heat.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 3000000000000000000n,
        maxSupply: null,
      },
      {
        gameId: creatureQuest.id,
        name: 'Victory Dance',
        description: 'Your creatures dance and celebrate after winning battles. Pure flex.',
        category: 'cosmetic',
        rarity: 'epic',
        price: 8000000000000000000n,
        maxSupply: 200,
      },
      {
        gameId: creatureQuest.id,
        name: 'Legendary Trainer Outfit',
        description: 'Complete outfit set: hat, jacket, boots, and trail effect. Champion style.',
        category: 'cosmetic',
        rarity: 'epic',
        price: 15000000000000000000n,
        maxSupply: 150,
      },
      {
        gameId: creatureQuest.id,
        name: 'Void Creatures Set',
        description:
          'Shadow particle effects on ALL creatures. Dark battle backgrounds. 100 exist. Ever.',
        category: 'cosmetic',
        rarity: 'legendary',
        price: 45000000000000000000n,
        maxSupply: 100,
      },
    );
  }

  // Click Race items
  if (clickRace) {
    demoItems.push(
      {
        gameId: clickRace.id,
        name: 'Neon Click Effect',
        description: 'Rainbow particle burst on every click. Stand out in multiplayer races.',
        category: 'cosmetic',
        rarity: 'common',
        price: 200000000000000000n,
        maxSupply: null,
      },
      {
        gameId: clickRace.id,
        name: 'Golden Cursor Skin',
        description: 'Shiny golden click animation. Your clicks look premium.',
        category: 'cosmetic',
        rarity: 'uncommon',
        price: 1000000000000000000n,
        maxSupply: null,
      },
      {
        gameId: clickRace.id,
        name: 'Click Streak Trail',
        description: 'Animated trail that grows with your combo. Opponents see your momentum.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 3000000000000000000n,
        maxSupply: null,
      },
    );
  }

  // Molt Arena (side-battler) items
  if (moltArena) {
    demoItems.push(
      {
        gameId: moltArena.id,
        name: 'War Paint',
        description: 'Face paint on your party members. Four unique designs per class.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: moltArena.id,
        name: 'Formation Glow',
        description: 'Glowing aura around your front and back row positions during combat.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 3500000000000000000n,
        maxSupply: null,
      },
      {
        gameId: moltArena.id,
        name: 'Dragon Fire Slash',
        description: 'Fire animations on all attack moves. Your strikes leave burning trails.',
        category: 'cosmetic',
        rarity: 'epic',
        price: 10000000000000000000n,
        maxSupply: 200,
      },
    );
  }

  // Voxel Runner (platformer) items
  if (voxelRunner) {
    demoItems.push(
      {
        gameId: voxelRunner.id,
        name: 'Fire Footsteps',
        description: 'Flame prints appear where you walk. Leave a trail of fire behind you.',
        category: 'cosmetic',
        rarity: 'common',
        price: 200000000000000000n,
        maxSupply: null,
      },
      {
        gameId: voxelRunner.id,
        name: 'Rainbow Jump Trail',
        description: 'Rainbow arc follows every jump. Beautiful in side-scroll view.',
        category: 'cosmetic',
        rarity: 'uncommon',
        price: 1000000000000000000n,
        maxSupply: null,
      },
    );
  }

  // Match Pairs (puzzle) items
  if (matchPairs) {
    demoItems.push(
      {
        gameId: matchPairs.id,
        name: 'Ocean Tile Theme',
        description: 'Underwater card backs with bubble animations. Fresh visual for every game.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: matchPairs.id,
        name: 'Match Celebration FX',
        description: 'Custom confetti explosion when pairs are matched. Satisfying feedback.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 3500000000000000000n,
        maxSupply: null,
      },
    );
  }

  // Beat Blaster (rhythm) items
  if (beatBlaster) {
    demoItems.push(
      {
        gameId: beatBlaster.id,
        name: 'Rainbow Note Trail',
        description: 'Colorful trails behind notes as they fall. Every hit looks spectacular.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: beatBlaster.id,
        name: 'Custom Hit Sound Pack',
        description: 'Unique chime sounds on perfect hits. Hear the difference.',
        category: 'cosmetic',
        rarity: 'rare',
        price: 2500000000000000000n,
        maxSupply: null,
      },
    );
  }

  // Dungeon Crawl (RPG) items
  if (dungeonCrawl) {
    demoItems.push(
      {
        gameId: dungeonCrawl.id,
        name: 'Iron Warrior Skin',
        description: 'Full plate armor look for the Warrior class. Heavy metal aesthetic.',
        category: 'cosmetic',
        rarity: 'common',
        price: 300000000000000000n,
        maxSupply: null,
      },
      {
        gameId: dungeonCrawl.id,
        name: 'Arcane Mage Robe',
        description: 'Glowing rune patterns on the Mage outfit. Mystical and imposing.',
        category: 'cosmetic',
        rarity: 'uncommon',
        price: 1500000000000000000n,
        maxSupply: null,
      },
      {
        gameId: dungeonCrawl.id,
        name: 'Dragon Slayer Aura',
        description: 'Fire particle effects after defeating bosses. The ultimate victory flair.',
        category: 'cosmetic',
        rarity: 'epic',
        price: 12000000000000000000n,
        maxSupply: 150,
      },
    );
  }

  for (const item of demoItems) {
    // Use name + gameId as unique key (upsert by checking if exists)
    const existing = await prisma.item.findFirst({
      where: { name: item.name, gameId: item.gameId },
    });
    if (!existing) {
      // Destructure price separately: Prisma 7.x BigInt serialization fails
      // when BigInt literals are spread via ...item into create()
      const { price, ...rest } = item;
      await prisma.item.create({
        data: {
          ...rest,
          price: BigInt(price),
          creatorId: demoBot.id,
          active: true,
          properties: {},
          currentSupply: item.maxSupply ?? 0,
        },
      });
    }
  }
  console.log(`  Created ${demoItems.length} demo marketplace items`);

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {
        description: badge.description,
        category: badge.category,
        criteria: badge.criteria,
      },
      create: badge,
    });
  }
  console.log(`  Created ${badges.length} badges`);

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
