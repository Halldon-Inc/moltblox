/**
 * CreatureRPGGame — A Pokemon-style RPG template for Moltblox
 *
 * This template demonstrates the most ambitious game you can build with BaseGame:
 * a full creature-collecting RPG with overworld exploration, wild encounters,
 * trainer battles, type effectiveness, status effects, catching mechanics,
 * leveling, and a gym leader boss fight.
 *
 * HOW IT WORKS:
 * The game has two main phases — overworld and battle.
 *
 * OVERWORLD: The player walks through a tile-based map using directional movement.
 * Tall grass tiles have a 15% chance of triggering wild creature encounters.
 * NPC trainers block paths and must be defeated to pass. Healing centers
 * restore the party to full health.
 *
 * BATTLE: Classic turn-based combat. The faster creature (by SPD stat) goes first.
 * Players choose from 4 moves, each with a type, power, accuracy, and PP cost.
 * Type effectiveness creates a rock-paper-scissors layer of strategy.
 * Wild creatures can be caught; trainer battles must be won.
 *
 * WHY this design works:
 * - The starter choice creates immediate investment ("my creature")
 * - Wild encounters on grass create risk/reward tension for exploration
 * - Type effectiveness rewards learning and team composition
 * - Catching expands options but costs resources (capture orbs)
 * - Trainer battles gate progression and test readiness
 * - The gym leader is a genuine skill check requiring good strategy
 *
 * ACTIONS:
 *   choose_starter { species }        — Pick your first creature
 *   move { direction }                — Walk in the overworld
 *   interact {}                       — Talk to NPC / enter building
 *   advance_dialogue {}               — Progress dialogue text
 *   fight { moveIndex }               — Use a move in battle
 *   switch_creature { partyIndex }    — Swap active creature
 *   use_item { item }                 — Use a potion in battle
 *   catch {}                          — Throw capture orb (wild only)
 *   flee {}                           — Run from wild encounter
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// ---------------------------------------------------------------------------
// Type System
// ---------------------------------------------------------------------------

type CreatureType = 'fire' | 'water' | 'grass' | 'electric' | 'ghost' | 'normal';

/**
 * Type effectiveness chart.
 * 2.0 = super effective, 0.5 = not very effective, 0 = immune, 1 = neutral.
 *
 * The classic triangle: Fire > Grass > Water > Fire
 * Electric beats Water. Ghost and Normal are immune to each other.
 * Ghost is super effective against itself.
 */
const TYPE_CHART: Record<CreatureType, Record<CreatureType, number>> = {
  fire: { fire: 0.5, water: 0.5, grass: 2.0, electric: 1.0, ghost: 1.0, normal: 1.0 },
  water: { fire: 2.0, water: 0.5, grass: 0.5, electric: 1.0, ghost: 1.0, normal: 1.0 },
  grass: { fire: 0.5, water: 2.0, grass: 0.5, electric: 1.0, ghost: 1.0, normal: 1.0 },
  electric: { fire: 1.0, water: 2.0, grass: 0.5, electric: 0.5, ghost: 1.0, normal: 1.0 },
  ghost: { fire: 1.0, water: 1.0, grass: 1.0, electric: 1.0, ghost: 2.0, normal: 0.0 },
  normal: { fire: 1.0, water: 1.0, grass: 1.0, electric: 1.0, ghost: 0.0, normal: 1.0 },
};

function getEffectiveness(attackType: CreatureType, defenderType: CreatureType): number {
  return TYPE_CHART[attackType]?.[defenderType] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Creature & Move Interfaces
// ---------------------------------------------------------------------------

interface CreatureStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spatk: number;
  spdef: number;
  spd: number;
  [key: string]: unknown;
}

interface StatusEffect {
  type: 'burn' | 'poison' | 'paralysis';
  turnsActive: number;
  [key: string]: unknown;
}

interface Move {
  name: string;
  type: CreatureType;
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
  category: 'physical' | 'special' | 'status';
  statusEffect?: { type: 'burn' | 'poison' | 'paralysis'; chance: number };
  statChange?: {
    stat: 'atk' | 'def' | 'spatk' | 'spdef';
    stages: number;
    target: 'self' | 'enemy';
  };
  heals?: boolean;
  description: string;
  [key: string]: unknown;
}

interface Creature {
  id: string;
  species: string;
  type: CreatureType;
  level: number;
  xp: number;
  xpToLevel: number;
  stats: CreatureStats;
  moves: Move[];
  statusEffect: StatusEffect | null;
  statStages: Record<string, number>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Species Database
// ---------------------------------------------------------------------------

interface SpeciesData {
  type: CreatureType;
  baseStats: { hp: number; atk: number; def: number; spatk: number; spdef: number; spd: number };
  moves: Omit<Move, 'pp'>[];
  description: string;
}

const SPECIES: Record<string, SpeciesData> = {
  emberfox: {
    type: 'fire',
    description: 'A blazing fox with a fiery tail. Fast and hits hard with special attacks.',
    baseStats: { hp: 45, atk: 52, def: 40, spatk: 60, spdef: 45, spd: 58 },
    moves: [
      {
        name: 'Flame Fang',
        type: 'fire',
        power: 55,
        accuracy: 95,
        maxPp: 15,
        category: 'physical',
        statusEffect: { type: 'burn', chance: 20 },
        description: 'Bite with fiery fangs. May burn.',
      },
      {
        name: 'Ember Burst',
        type: 'fire',
        power: 65,
        accuracy: 90,
        maxPp: 10,
        category: 'special',
        description: 'Unleash a burst of cinders.',
      },
      {
        name: 'Quick Strike',
        type: 'normal',
        power: 40,
        accuracy: 100,
        maxPp: 20,
        category: 'physical',
        description: 'A swift strike. Never misses.',
      },
      {
        name: 'Tail Whip',
        type: 'normal',
        power: 0,
        accuracy: 100,
        maxPp: 20,
        category: 'status',
        statChange: { stat: 'def', stages: -1, target: 'enemy' },
        description: 'Lower enemy DEF.',
      },
    ],
  },
  aquaphin: {
    type: 'water',
    description: 'A sleek dolphin creature. Tanky with balanced offense.',
    baseStats: { hp: 55, atk: 45, def: 55, spatk: 55, spdef: 50, spd: 40 },
    moves: [
      {
        name: 'Aqua Jet',
        type: 'water',
        power: 50,
        accuracy: 100,
        maxPp: 15,
        category: 'physical',
        description: 'A water-cloaked tackle. Always hits.',
      },
      {
        name: 'Bubble Beam',
        type: 'water',
        power: 65,
        accuracy: 95,
        maxPp: 10,
        category: 'special',
        description: 'Pressurized bubbles. Solid special damage.',
      },
      {
        name: 'Headbutt',
        type: 'normal',
        power: 45,
        accuracy: 100,
        maxPp: 20,
        category: 'physical',
        description: 'A simple headbutt.',
      },
      {
        name: 'Shell Guard',
        type: 'water',
        power: 0,
        accuracy: 100,
        maxPp: 15,
        category: 'status',
        statChange: { stat: 'def', stages: 1, target: 'self' },
        description: 'Harden shell to raise DEF.',
      },
    ],
  },
  thornvine: {
    type: 'grass',
    description: 'A thorny vine creature. Bulky with status-inflicting attacks.',
    baseStats: { hp: 50, atk: 48, def: 55, spatk: 58, spdef: 55, spd: 34 },
    moves: [
      {
        name: 'Vine Lash',
        type: 'grass',
        power: 55,
        accuracy: 95,
        maxPp: 15,
        category: 'physical',
        description: 'Whip with thorny vines.',
      },
      {
        name: 'Leaf Storm',
        type: 'grass',
        power: 70,
        accuracy: 90,
        maxPp: 8,
        category: 'special',
        statusEffect: { type: 'poison', chance: 30 },
        description: 'Razor leaves tear through. May poison.',
      },
      {
        name: 'Tackle',
        type: 'normal',
        power: 40,
        accuracy: 100,
        maxPp: 25,
        category: 'physical',
        description: 'A basic charge.',
      },
      {
        name: 'Leech Seed',
        type: 'grass',
        power: 0,
        accuracy: 90,
        maxPp: 10,
        category: 'status',
        heals: true,
        description: 'Drain enemy HP each turn. Heals you.',
      },
    ],
  },
  zappup: {
    type: 'electric',
    description: 'An electric puppy crackling with energy. Blazing fast but fragile.',
    baseStats: { hp: 40, atk: 35, def: 30, spatk: 55, spdef: 40, spd: 65 },
    moves: [
      {
        name: 'Spark',
        type: 'electric',
        power: 50,
        accuracy: 95,
        maxPp: 15,
        category: 'special',
        statusEffect: { type: 'paralysis', chance: 25 },
        description: 'Electric shock. May paralyze.',
      },
      {
        name: 'Thunder Fang',
        type: 'electric',
        power: 55,
        accuracy: 90,
        maxPp: 12,
        category: 'physical',
        description: 'Electrified bite.',
      },
      {
        name: 'Quick Strike',
        type: 'normal',
        power: 40,
        accuracy: 100,
        maxPp: 20,
        category: 'physical',
        description: 'A swift strike.',
      },
      {
        name: 'Howl',
        type: 'normal',
        power: 0,
        accuracy: 100,
        maxPp: 20,
        category: 'status',
        statChange: { stat: 'atk', stages: 1, target: 'self' },
        description: 'Howl to raise ATK.',
      },
    ],
  },
  shadewisp: {
    type: 'ghost',
    description: 'A spectral wisp of shadow energy. Devastating special attacks.',
    baseStats: { hp: 35, atk: 30, def: 25, spatk: 65, spdef: 55, spd: 55 },
    moves: [
      {
        name: 'Shadow Bolt',
        type: 'ghost',
        power: 60,
        accuracy: 95,
        maxPp: 12,
        category: 'special',
        description: 'Hurl spectral energy.',
      },
      {
        name: 'Night Shade',
        type: 'ghost',
        power: 50,
        accuracy: 100,
        maxPp: 15,
        category: 'special',
        description: 'Dark energy blast.',
      },
      {
        name: 'Lick',
        type: 'ghost',
        power: 30,
        accuracy: 100,
        maxPp: 20,
        category: 'physical',
        statusEffect: { type: 'paralysis', chance: 30 },
        description: 'Ghostly tongue. May paralyze.',
      },
      {
        name: 'Curse',
        type: 'ghost',
        power: 0,
        accuracy: 100,
        maxPp: 10,
        category: 'status',
        statChange: { stat: 'spdef', stages: 1, target: 'self' },
        description: 'Boost your SPDEF at a cost.',
      },
    ],
  },
  pebblecrab: {
    type: 'normal',
    description: 'A sturdy rock crab. Incredibly tough but slow.',
    baseStats: { hp: 55, atk: 50, def: 65, spatk: 30, spdef: 45, spd: 25 },
    moves: [
      {
        name: 'Rock Toss',
        type: 'normal',
        power: 55,
        accuracy: 95,
        maxPp: 15,
        category: 'physical',
        description: 'Hurl a pebble.',
      },
      {
        name: 'Claw Crush',
        type: 'normal',
        power: 70,
        accuracy: 85,
        maxPp: 10,
        category: 'physical',
        description: 'Crush with massive claw.',
      },
      {
        name: 'Harden',
        type: 'normal',
        power: 0,
        accuracy: 100,
        maxPp: 20,
        category: 'status',
        statChange: { stat: 'def', stages: 1, target: 'self' },
        description: 'Harden shell. Raise DEF.',
      },
      {
        name: 'Headbutt',
        type: 'normal',
        power: 45,
        accuracy: 100,
        maxPp: 20,
        category: 'physical',
        description: 'A simple headbutt.',
      },
    ],
  },
};

const VALID_STARTERS = ['emberfox', 'aquaphin', 'thornvine'];

// ---------------------------------------------------------------------------
// Stat Calculations
// ---------------------------------------------------------------------------

function calcHpForLevel(baseHp: number, level: number): number {
  return baseHp + Math.floor(baseHp * (level - 1) * 0.12) + level * 2;
}

function calcStatForLevel(baseStat: number, level: number): number {
  return baseStat + Math.floor(baseStat * (level - 1) * 0.08);
}

function xpForLevel(level: number): number {
  return level * level * 8;
}

function xpFromBattle(enemyLevel: number, isTrainer: boolean): number {
  const base = enemyLevel * 12;
  return isTrainer ? Math.floor(base * 1.5) : base;
}

function createCreature(species: string, level: number, id?: string): Creature {
  const data = SPECIES[species];
  if (!data) throw new Error(`Unknown species: ${species}`);
  const maxHp = calcHpForLevel(data.baseStats.hp, level);
  return {
    id: id || `${species}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    species,
    type: data.type,
    level,
    xp: 0,
    xpToLevel: xpForLevel(level + 1),
    stats: {
      hp: maxHp,
      maxHp,
      atk: calcStatForLevel(data.baseStats.atk, level),
      def: calcStatForLevel(data.baseStats.def, level),
      spatk: calcStatForLevel(data.baseStats.spatk, level),
      spdef: calcStatForLevel(data.baseStats.spdef, level),
      spd: calcStatForLevel(data.baseStats.spd, level),
    },
    moves: data.moves.map((m) => ({ ...m, pp: m.maxPp }) as Move),
    statusEffect: null,
    statStages: { atk: 0, def: 0, spatk: 0, spdef: 0 },
  };
}

function getStatMultiplier(stages: number): number {
  // Each stage = ±0.25 multiplier, capped at ±3
  const clamped = Math.max(-3, Math.min(3, stages));
  if (clamped >= 0) return 1 + clamped * 0.25;
  return 1 / (1 + Math.abs(clamped) * 0.25);
}

function getEffectiveStat(
  creature: Creature,
  stat: 'atk' | 'def' | 'spatk' | 'spdef' | 'spd',
): number {
  const base = creature.stats[stat] as number;
  const stages = (creature.statStages[stat] as number) || 0;
  let value = Math.floor(base * getStatMultiplier(stages));
  // Paralysis halves speed
  if (stat === 'spd' && creature.statusEffect?.type === 'paralysis') {
    value = Math.floor(value / 2);
  }
  return Math.max(1, value);
}

// ---------------------------------------------------------------------------
// Damage Calculation
// ---------------------------------------------------------------------------

/**
 * Simplified Gen V damage formula:
 * ((2 * level / 5 + 2) * power * A/D) / 50 + 2
 * Then apply STAB, type effectiveness, critical, and random factor.
 *
 * WHY this formula: It scales well with levels 5-15 (our range),
 * produces damage in the 10-50 range which feels good with ~50-100 HP pools,
 * and creates clear power differences between types.
 */
function calculateDamage(
  attacker: Creature,
  defender: Creature,
  move: Move,
): { damage: number; effectiveness: number; critical: boolean } {
  if (move.power === 0) return { damage: 0, effectiveness: 1, critical: false };

  const level = attacker.level;
  const A =
    move.category === 'physical'
      ? getEffectiveStat(attacker, 'atk')
      : getEffectiveStat(attacker, 'spatk');
  const D =
    move.category === 'physical'
      ? getEffectiveStat(defender, 'def')
      : getEffectiveStat(defender, 'spdef');

  const baseDamage = Math.floor((((2 * level) / 5 + 2) * move.power * A) / Math.max(1, D) / 50 + 2);

  // STAB: Same Type Attack Bonus
  const stab = move.type === attacker.type ? 1.5 : 1.0;

  // Type effectiveness
  const effectiveness = getEffectiveness(move.type, defender.type);

  // Critical hit: 6.25% chance, 1.5x
  const critRoll = Math.random();
  const critical = critRoll < 0.0625;
  const critMult = critical ? 1.5 : 1.0;

  // Random factor: 85-100%
  const randomFactor = 0.85 + Math.random() * 0.15;

  const totalDamage = Math.max(
    1,
    Math.floor(baseDamage * stab * effectiveness * critMult * randomFactor),
  );

  return { damage: totalDamage, effectiveness, critical };
}

// ---------------------------------------------------------------------------
// Map System
// ---------------------------------------------------------------------------

/**
 * Tile types for the overworld map.
 * 0=grass, 1=tall_grass, 2=tree, 3=water, 4=path, 5=building,
 * 6=door, 7=fence, 8=flower, 9=sign, 10=heal, 11=gym_door, 12=sand
 */
const T = {
  GRASS: 0,
  TALL_GRASS: 1,
  TREE: 2,
  WATER: 3,
  PATH: 4,
  BUILDING: 5,
  DOOR: 6,
  FENCE: 7,
  FLOWER: 8,
  SIGN: 9,
  HEAL: 10,
  GYM_DOOR: 11,
  SAND: 12,
} as const;

const PASSABLE: Set<number> = new Set([
  T.GRASS,
  T.TALL_GRASS,
  T.PATH,
  T.FLOWER,
  T.SAND,
  T.DOOR,
  T.HEAL,
  T.GYM_DOOR,
]);

/**
 * Map data: 30 columns x 20 rows per zone.
 * Three zones connected by warp points at map edges.
 *
 * STARTER TOWN: Safe area with professor, healing center, south exit
 * ROUTE 1: Grass patches with wild encounters, 2 trainers, connects town to city
 * VERDANT CITY: Healing center, gym, NPC guide
 */

// prettier-ignore
const MAP_STARTER_TOWN: number[][] = [
  [7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,2,2,0,0,0,0,0,5,5,5,5,0,0,0,0,5,5,5,5,0,0,0,2,2,0,0,7],
  [7,0,0,2,0,0,0,0,0,0,5,5,5,5,0,0,0,0,5,5,5,5,0,0,0,0,2,0,0,7],
  [7,0,0,0,0,0,8,0,0,0,5,5,5,5,0,0,0,0,5,5,5,5,0,0,8,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,7],
  [7,0,0,8,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,8,0,0,7],
  [7,0,0,0,0,4,0,0,5,5,5,5,0,0,0,0,0,0,0,0,9,0,0,0,4,0,0,0,0,7],
  [7,0,2,0,0,4,0,0,5,5,5,5,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,2,0,7],
  [7,0,2,0,0,4,0,0,5,5,5,5,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,2,0,7],
  [7,0,0,0,0,4,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,7],
  [7,0,0,8,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,4,0,8,0,0,7],
  [7,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,2,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,2,0,0,7],
  [7,0,2,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,2,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,7,7,7,7,7,7,7,7,7,7,7,7,4,0,0,4,7,7,7,7,7,7,7,7,7,7,7,7,7],
];

// prettier-ignore
const MAP_ROUTE_1: number[][] = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,4,0,0,4,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,0,0,1,1,1,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,1,1,1,0,0,0,2],
  [2,0,1,1,1,1,1,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,1,1,1,1,1,0,0,2],
  [2,0,1,1,1,1,0,0,0,2,0,0,0,4,0,0,4,0,0,0,2,0,0,1,1,1,0,0,0,2],
  [2,0,0,1,1,0,0,0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,0,1,1,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,2,0,0,0,0,4,4,0,0,0,0,0,0,4,4,0,0,0,0,2,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,2],
  [2,3,3,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,3,3,2],
  [2,3,3,3,0,0,0,4,4,0,0,0,0,9,0,0,0,0,0,0,0,4,4,0,0,0,3,3,3,2],
  [2,3,3,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,3,3,2],
  [2,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,2],
  [2,0,0,0,4,4,0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0,4,4,0,0,0,2],
  [2,0,0,4,4,0,0,0,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,0,4,4,0,0,2],
  [2,0,4,4,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,4,4,0,2],
  [2,0,4,0,0,0,0,0,0,1,1,0,0,0,2,0,0,2,0,0,0,1,1,0,0,0,0,4,0,2],
  [2,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,2],
  [2,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,2],
  [2,0,0,4,4,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,4,4,0,0,2],
  [2,2,2,2,4,2,2,2,2,2,2,2,2,4,0,0,4,2,2,2,2,2,2,2,2,4,2,2,2,2],
];

// prettier-ignore
const MAP_VERDANT_CITY: number[][] = [
  [7,7,7,7,4,7,7,7,7,7,7,7,7,4,0,0,4,7,7,7,7,7,7,7,7,4,7,7,7,7],
  [7,0,0,0,4,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,4,0,0,0,7],
  [7,0,5,5,4,5,5,0,0,0,0,0,0,4,0,0,4,0,0,0,0,5,5,5,5,4,5,5,0,7],
  [7,0,5,5,4,5,5,0,0,0,0,0,0,4,4,4,4,0,0,0,0,5,5,5,5,4,5,5,0,7],
  [7,0,5,5,4,5,5,0,0,0,9,0,0,0,0,0,0,0,0,0,0,5,5,5,5,4,5,5,0,7],
  [7,0,0,10,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,4,0,0,0,7],
  [7,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,7],
  [7,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
  [7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7],
];

const MAPS: Record<string, number[][]> = {
  starter_town: MAP_STARTER_TOWN,
  route_1: MAP_ROUTE_1,
  verdant_city: MAP_VERDANT_CITY,
};

interface WarpPoint {
  fromMap: string;
  fromX: number;
  fromY: number;
  toMap: string;
  toX: number;
  toY: number;
}

const WARPS: WarpPoint[] = [
  // Starter Town → Route 1 (south exit)
  { fromMap: 'starter_town', fromX: 13, fromY: 19, toMap: 'route_1', toX: 13, toY: 0 },
  { fromMap: 'starter_town', fromX: 14, fromY: 19, toMap: 'route_1', toX: 14, toY: 0 },
  { fromMap: 'starter_town', fromX: 15, fromY: 19, toMap: 'route_1', toX: 15, toY: 0 },
  // Route 1 → Starter Town (north exit)
  { fromMap: 'route_1', fromX: 13, fromY: 0, toMap: 'starter_town', toX: 13, toY: 18 },
  { fromMap: 'route_1', fromX: 14, fromY: 0, toMap: 'starter_town', toX: 14, toY: 18 },
  { fromMap: 'route_1', fromX: 15, fromY: 0, toMap: 'starter_town', toX: 15, toY: 18 },
  // Route 1 → Verdant City (south exit)
  { fromMap: 'route_1', fromX: 13, fromY: 19, toMap: 'verdant_city', toX: 13, toY: 0 },
  { fromMap: 'route_1', fromX: 14, fromY: 19, toMap: 'verdant_city', toX: 14, toY: 0 },
  { fromMap: 'route_1', fromX: 15, fromY: 19, toMap: 'verdant_city', toX: 15, toY: 0 },
  // Verdant City → Route 1 (north exit)
  { fromMap: 'verdant_city', fromX: 13, fromY: 0, toMap: 'route_1', toX: 13, toY: 18 },
  { fromMap: 'verdant_city', fromX: 14, fromY: 0, toMap: 'route_1', toX: 14, toY: 18 },
  { fromMap: 'verdant_city', fromX: 15, fromY: 0, toMap: 'route_1', toX: 15, toY: 18 },
];

// ---------------------------------------------------------------------------
// Encounter Tables
// ---------------------------------------------------------------------------

interface EncounterEntry {
  species: string;
  levelRange: [number, number];
  weight: number;
}

const ENCOUNTER_TABLES: Record<string, EncounterEntry[]> = {
  route_1: [
    { species: 'zappup', levelRange: [3, 5], weight: 35 },
    { species: 'pebblecrab', levelRange: [3, 5], weight: 35 },
    { species: 'shadewisp', levelRange: [4, 6], weight: 30 },
  ],
};

const ENCOUNTER_RATE = 0.15;

function rollEncounter(mapId: string): Creature | null {
  const table = ENCOUNTER_TABLES[mapId];
  if (!table || Math.random() > ENCOUNTER_RATE) return null;

  const totalWeight = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) {
      const level =
        entry.levelRange[0] +
        Math.floor(Math.random() * (entry.levelRange[1] - entry.levelRange[0] + 1));
      return createCreature(entry.species, level);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// NPC Data
// ---------------------------------------------------------------------------

interface NPCDef {
  id: string;
  name: string;
  type: 'trainer' | 'healer' | 'guide' | 'professor';
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  dialogue: string[];
  party?: { species: string; level: number }[];
  blocksPath?: boolean;
}

const NPC_DEFS: NPCDef[] = [
  {
    id: 'professor',
    name: 'Professor Elm',
    type: 'professor',
    mapId: 'starter_town',
    x: 10,
    y: 11,
    direction: 'down',
    dialogue: [
      'Welcome to the world of creatures!',
      'I have three creature partners ready for you.',
      'Choose wisely — your starter will be your best friend on this journey!',
    ],
  },
  {
    id: 'mom',
    name: 'Mom',
    type: 'guide',
    mapId: 'starter_town',
    x: 19,
    y: 5,
    direction: 'down',
    dialogue: [
      'Be careful out there, sweetie!',
      'Tall grass hides wild creatures — be ready to battle!',
      'Visit the healing center if your creatures are hurt.',
    ],
  },
  {
    id: 'trainer_1',
    name: 'Bug Catcher Tim',
    type: 'trainer',
    mapId: 'route_1',
    x: 7,
    y: 7,
    direction: 'right',
    dialogue: ['Hey! You look like a new trainer!', "Let's see what you've got!"],
    party: [{ species: 'pebblecrab', level: 4 }],
    blocksPath: true,
  },
  {
    id: 'trainer_2',
    name: 'Lass Jenny',
    type: 'trainer',
    mapId: 'route_1',
    x: 22,
    y: 14,
    direction: 'left',
    dialogue: ["I won't let you pass without a fight!", 'Prepare yourself!'],
    party: [{ species: 'zappup', level: 5 }],
    blocksPath: true,
  },
  {
    id: 'healer_town',
    name: 'Nurse Joy',
    type: 'healer',
    mapId: 'starter_town',
    x: 19,
    y: 4,
    direction: 'down',
    dialogue: ['Your creatures are fully healed!', 'Come back anytime!'],
  },
  {
    id: 'healer_city',
    name: 'Nurse Joy',
    type: 'healer',
    mapId: 'verdant_city',
    x: 3,
    y: 5,
    direction: 'down',
    dialogue: ['Welcome to Verdant City!', 'Your creatures are fully healed!'],
  },
  {
    id: 'guide_city',
    name: 'Ranger Blake',
    type: 'guide',
    mapId: 'verdant_city',
    x: 13,
    y: 9,
    direction: 'up',
    dialogue: [
      'The Verdant Gym is straight ahead!',
      'Gym Leader Verdana uses Ghost and Grass types.',
      'Make sure your team is ready!',
    ],
  },
  {
    id: 'gym_leader',
    name: 'Gym Leader Verdana',
    type: 'trainer',
    mapId: 'verdant_city',
    x: 22,
    y: 5,
    direction: 'down',
    dialogue: [
      'Welcome, challenger.',
      'I am Verdana, the Verdant City Gym Leader.',
      'My bond with my creatures runs deeper than you can imagine.',
      'Show me the strength of your team!',
    ],
    party: [
      { species: 'shadewisp', level: 8 },
      { species: 'thornvine', level: 10 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Game State
// ---------------------------------------------------------------------------

interface Inventory {
  potions: number;
  captureOrbs: number;
  [key: string]: unknown;
}

interface BattleState {
  type: 'wild' | 'trainer' | 'gym';
  activeIndex: number;
  enemyCreature: Creature;
  enemyParty: Creature[];
  enemyPartyIndex: number;
  canCatch: boolean;
  canFlee: boolean;
  trainerId: string | null;
  trainerName: string | null;
  turnCount: number;
  leechSeedActive: boolean;
  leechSeedSource: 'player' | 'enemy' | null;
  message: string | null;
  awaitingAction: boolean;
  [key: string]: unknown;
}

interface CreatureRPGState {
  gamePhase: 'starter_select' | 'overworld' | 'battle' | 'dialogue' | 'victory' | 'defeat';
  party: Creature[];
  activeCreatureIndex: number;
  inventory: Inventory;
  playerPos: { x: number; y: number };
  playerDirection: 'up' | 'down' | 'left' | 'right';
  mapId: string;
  defeatedTrainers: string[];
  caughtSpecies: string[];
  starterChosen: boolean;
  dialogueLines: string[];
  dialogueIndex: number;
  dialogueSpeaker: string;
  postDialogueAction: string | null;
  battleState: BattleState | null;
  gymDefeated: boolean;
  totalBattlesWon: number;
  totalCreaturesCaught: number;
  totalSteps: number;
  combatLog: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// The Game
// ---------------------------------------------------------------------------

export class CreatureRPGGame extends BaseGame {
  readonly name = 'Creature Quest';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): Record<string, unknown> {
    const state: CreatureRPGState = {
      gamePhase: 'starter_select',
      party: [],
      activeCreatureIndex: 0,
      inventory: { potions: 5, captureOrbs: 10 },
      playerPos: { x: 14, y: 6 },
      playerDirection: 'down',
      mapId: 'starter_town',
      defeatedTrainers: [],
      caughtSpecies: [],
      starterChosen: false,
      dialogueLines: [
        'Welcome to the world of creatures!',
        'Choose your starter: Emberfox (Fire), Aquaphin (Water), or Thornvine (Grass).',
      ],
      dialogueIndex: 0,
      dialogueSpeaker: 'Professor Elm',
      postDialogueAction: null,
      battleState: null,
      gymDefeated: false,
      totalBattlesWon: 0,
      totalCreaturesCaught: 0,
      totalSteps: 0,
      combatLog: [],
    };
    this.emitEvent('game_started', playerIds[0]);
    return state;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CreatureRPGState>();
    const type = action.type;
    const payload = action.payload || {};

    switch (type) {
      case 'choose_starter':
        return this.handleChooseStarter(data, payload);
      case 'move':
        return this.handleMove(data, payload);
      case 'interact':
        return this.handleInteract(data);
      case 'advance_dialogue':
        return this.handleAdvanceDialogue(data);
      case 'fight':
        return this.handleFight(data, payload);
      case 'switch_creature':
        return this.handleSwitch(data, payload);
      case 'use_item':
        return this.handleUseItem(data, payload);
      case 'catch':
        return this.handleCatch(data);
      case 'flee':
        return this.handleFlee(data);
      default:
        return { success: false, error: `Unknown action: ${type}` };
    }
  }

  // --- Starter Selection ---

  private handleChooseStarter(
    data: CreatureRPGState,
    payload: Record<string, unknown>,
  ): ActionResult {
    if (data.starterChosen) {
      return { success: false, error: 'Starter already chosen' };
    }
    const species = String(payload.species || '').toLowerCase();
    if (!VALID_STARTERS.includes(species)) {
      return { success: false, error: `Invalid starter. Choose: ${VALID_STARTERS.join(', ')}` };
    }

    const starter = createCreature(species, 5, `starter_${species}`);
    data.party = [starter];
    data.activeCreatureIndex = 0;
    data.starterChosen = true;
    data.caughtSpecies = [species];
    data.gamePhase = 'overworld';
    data.combatLog.push(`You chose ${species.charAt(0).toUpperCase() + species.slice(1)}!`);

    this.setData(data as Record<string, unknown>);
    this.emitEvent('starter_chosen', this.getPlayers()[0], { species });
    return { success: true, newState: this.state };
  }

  // --- Overworld Movement ---

  private handleMove(data: CreatureRPGState, payload: Record<string, unknown>): ActionResult {
    if (data.gamePhase !== 'overworld') {
      return { success: false, error: 'Cannot move in current phase' };
    }

    const dir = String(payload.direction || '');
    if (!['up', 'down', 'left', 'right'].includes(dir)) {
      return { success: false, error: 'Invalid direction' };
    }

    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const newX = data.playerPos.x + dx;
    const newY = data.playerPos.y + dy;

    data.playerDirection = dir as 'up' | 'down' | 'left' | 'right';

    // Check for warp point first
    const warp = WARPS.find(
      (w) => w.fromMap === data.mapId && w.fromX === newX && w.fromY === newY,
    );
    if (warp) {
      data.mapId = warp.toMap;
      data.playerPos = { x: warp.toX, y: warp.toY };
      data.totalSteps++;
      this.setData(data as Record<string, unknown>);
      this.emitEvent('zone_entered', this.getPlayers()[0], { zone: warp.toMap });
      return { success: true, newState: this.state };
    }

    // Check bounds
    const map = MAPS[data.mapId];
    if (!map || newY < 0 || newY >= map.length || newX < 0 || newX >= map[0].length) {
      this.setData(data as Record<string, unknown>);
      return { success: true, newState: this.state };
    }

    // Check if tile is passable
    const tile = map[newY][newX];
    // Check for NPC blocking
    const blockingNpc = NPC_DEFS.find(
      (n) => n.mapId === data.mapId && n.x === newX && n.y === newY,
    );
    if (blockingNpc) {
      this.setData(data as Record<string, unknown>);
      return { success: true, newState: this.state };
    }

    if (!PASSABLE.has(tile)) {
      this.setData(data as Record<string, unknown>);
      return { success: true, newState: this.state };
    }

    data.playerPos = { x: newX, y: newY };
    data.totalSteps++;

    // Check for tall grass encounter
    if (tile === T.TALL_GRASS) {
      const wildCreature = rollEncounter(data.mapId);
      if (wildCreature) {
        data.battleState = {
          type: 'wild',
          activeIndex: this.getFirstAliveIndex(data),
          enemyCreature: wildCreature,
          enemyParty: [wildCreature],
          enemyPartyIndex: 0,
          canCatch: true,
          canFlee: true,
          trainerId: null,
          trainerName: null,
          turnCount: 0,
          leechSeedActive: false,
          leechSeedSource: null,
          message: `A wild ${wildCreature.species.charAt(0).toUpperCase() + wildCreature.species.slice(1)} appeared!`,
          awaitingAction: true,
        };
        data.gamePhase = 'battle';
        data.activeCreatureIndex = this.getFirstAliveIndex(data);
        this.emitEvent('encounter', this.getPlayers()[0], { species: wildCreature.species });
      }
    }

    // Check for heal tile
    if (tile === T.HEAL) {
      this.healParty(data);
      data.combatLog.push('Your creatures were fully healed!');
      this.emitEvent('healed', this.getPlayers()[0]);
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Interact ---

  private handleInteract(data: CreatureRPGState): ActionResult {
    if (data.gamePhase !== 'overworld') {
      return { success: false, error: 'Cannot interact in current phase' };
    }

    // Find adjacent NPC
    const dirs: Record<string, [number, number]> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [dx, dy] = dirs[data.playerDirection] || [0, 0];
    const lookX = data.playerPos.x + dx;
    const lookY = data.playerPos.y + dy;

    const npc = NPC_DEFS.find((n) => n.mapId === data.mapId && n.x === lookX && n.y === lookY);

    if (!npc) {
      // Check for gym door
      const map = MAPS[data.mapId];
      if (map && map[lookY]?.[lookX] === T.GYM_DOOR) {
        const gymLeader = NPC_DEFS.find((n) => n.id === 'gym_leader');
        if (gymLeader && !data.defeatedTrainers.includes('gym_leader')) {
          data.dialogueLines = [...gymLeader.dialogue];
          data.dialogueIndex = 0;
          data.dialogueSpeaker = gymLeader.name;
          data.postDialogueAction = 'start_gym';
          data.gamePhase = 'dialogue';
          this.setData(data as Record<string, unknown>);
          return { success: true, newState: this.state };
        } else {
          data.dialogueLines = ['The gym is quiet. You already defeated the leader!'];
          data.dialogueIndex = 0;
          data.dialogueSpeaker = '';
          data.postDialogueAction = null;
          data.gamePhase = 'dialogue';
          this.setData(data as Record<string, unknown>);
          return { success: true, newState: this.state };
        }
      }

      // Check for sign
      if (map && map[lookY]?.[lookX] === T.SIGN) {
        const signTexts: Record<string, Record<string, string>> = {
          route_1: { '13_9': 'Route 1 — Wild creatures ahead! Be prepared.' },
          starter_town: { '20_8': 'Starter Town — A peaceful place to begin your journey.' },
          verdant_city: {
            '10_4': 'Verdant City Gym — Leader: Verdana',
            '13_9': 'Welcome to Verdant City!',
          },
        };
        const key = `${lookX}_${lookY}`;
        const text = signTexts[data.mapId]?.[key] || 'A weathered sign.';
        data.dialogueLines = [text];
        data.dialogueIndex = 0;
        data.dialogueSpeaker = 'Sign';
        data.postDialogueAction = null;
        data.gamePhase = 'dialogue';
        this.setData(data as Record<string, unknown>);
        return { success: true, newState: this.state };
      }

      return { success: true, newState: this.state };
    }

    // Handle NPC types
    if (npc.type === 'healer') {
      this.healParty(data);
      data.dialogueLines = [...npc.dialogue];
      data.dialogueIndex = 0;
      data.dialogueSpeaker = npc.name;
      data.postDialogueAction = null;
      data.gamePhase = 'dialogue';
    } else if (npc.type === 'trainer') {
      if (data.defeatedTrainers.includes(npc.id)) {
        data.dialogueLines = ["Good battle earlier! You're a strong trainer."];
        data.dialogueIndex = 0;
        data.dialogueSpeaker = npc.name;
        data.postDialogueAction = null;
        data.gamePhase = 'dialogue';
      } else {
        data.dialogueLines = [...npc.dialogue];
        data.dialogueIndex = 0;
        data.dialogueSpeaker = npc.name;
        data.postDialogueAction = `start_trainer_${npc.id}`;
        data.gamePhase = 'dialogue';
      }
    } else {
      data.dialogueLines = [...npc.dialogue];
      data.dialogueIndex = 0;
      data.dialogueSpeaker = npc.name;
      data.postDialogueAction = null;
      data.gamePhase = 'dialogue';
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Dialogue ---

  private handleAdvanceDialogue(data: CreatureRPGState): ActionResult {
    if (data.gamePhase !== 'dialogue') {
      return { success: false, error: 'Not in dialogue' };
    }

    data.dialogueIndex++;

    if (data.dialogueIndex >= data.dialogueLines.length) {
      // Dialogue finished — check for post-dialogue action
      const action = data.postDialogueAction;
      data.postDialogueAction = null;

      if (action === 'start_gym') {
        this.startTrainerBattle(data, 'gym_leader', 'gym');
      } else if (action?.startsWith('start_trainer_')) {
        const trainerId = action.replace('start_trainer_', '');
        this.startTrainerBattle(data, trainerId, 'trainer');
      } else {
        data.gamePhase = 'overworld';
      }
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle: Fight ---

  private handleFight(data: CreatureRPGState, payload: Record<string, unknown>): ActionResult {
    if (data.gamePhase !== 'battle' || !data.battleState) {
      return { success: false, error: 'Not in battle' };
    }
    if (!data.battleState.awaitingAction) {
      return { success: false, error: 'Not awaiting action' };
    }

    const moveIndex = Number(payload.moveIndex ?? -1);
    const player = data.party[data.battleState.activeIndex];
    if (!player || player.stats.hp <= 0) {
      return { success: false, error: 'Active creature is fainted' };
    }

    if (moveIndex < 0 || moveIndex >= player.moves.length) {
      return { success: false, error: 'Invalid move index' };
    }

    const move = player.moves[moveIndex];
    if (move.pp <= 0) {
      return { success: false, error: 'No PP remaining for this move' };
    }

    const enemy = data.battleState.enemyCreature;
    const playerSpd = getEffectiveStat(player, 'spd');
    const enemySpd = getEffectiveStat(enemy, 'spd');
    const playerFirst = playerSpd >= enemySpd;

    data.battleState.turnCount++;

    if (playerFirst) {
      this.executePlayerMove(data, player, enemy, move);
      if (enemy.stats.hp > 0) {
        this.executeEnemyMove(data, player, enemy);
      }
    } else {
      this.executeEnemyMove(data, player, enemy);
      if (player.stats.hp > 0) {
        this.executePlayerMove(data, player, enemy, move);
      }
    }

    // End-of-turn effects
    this.applyEndOfTurnEffects(data, player, enemy);

    // Check for faints
    this.checkBattleOutcome(data);

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle: Switch ---

  private handleSwitch(data: CreatureRPGState, payload: Record<string, unknown>): ActionResult {
    if (data.gamePhase !== 'battle' || !data.battleState) {
      return { success: false, error: 'Not in battle' };
    }

    const partyIndex = Number(payload.partyIndex ?? -1);
    if (partyIndex < 0 || partyIndex >= data.party.length) {
      return { success: false, error: 'Invalid party index' };
    }
    if (data.party[partyIndex].stats.hp <= 0) {
      return { success: false, error: 'Cannot switch to fainted creature' };
    }
    if (partyIndex === data.battleState.activeIndex) {
      return { success: false, error: 'Already active' };
    }

    const oldName = data.party[data.battleState.activeIndex].species;
    data.battleState.activeIndex = partyIndex;
    data.activeCreatureIndex = partyIndex;
    // Reset stat stages on switch
    data.party[partyIndex].statStages = { atk: 0, def: 0, spatk: 0, spdef: 0 };
    data.battleState.leechSeedActive = false;

    const newCreature = data.party[partyIndex];
    data.combatLog.push(
      `Switched from ${this.capitalize(oldName)} to ${this.capitalize(newCreature.species)}!`,
    );

    // Enemy gets a free turn on switch
    const enemy = data.battleState.enemyCreature;
    if (enemy.stats.hp > 0) {
      this.executeEnemyMove(data, newCreature, enemy);
    }
    this.applyEndOfTurnEffects(data, newCreature, enemy);
    this.checkBattleOutcome(data);

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle: Use Item ---

  private handleUseItem(data: CreatureRPGState, payload: Record<string, unknown>): ActionResult {
    if (data.gamePhase !== 'battle' || !data.battleState) {
      return { success: false, error: 'Not in battle' };
    }

    const item = String(payload.item || 'potion');
    if (item === 'potion') {
      if (data.inventory.potions <= 0) {
        return { success: false, error: 'No potions left' };
      }
      const creature = data.party[data.battleState.activeIndex];
      if (creature.stats.hp >= creature.stats.maxHp) {
        return { success: false, error: 'Already at full HP' };
      }

      data.inventory.potions--;
      const healed = Math.min(20, creature.stats.maxHp - creature.stats.hp);
      creature.stats.hp += healed;
      data.combatLog.push(
        `Used Potion! ${this.capitalize(creature.species)} recovered ${healed} HP.`,
      );

      // Enemy gets a turn
      const enemy = data.battleState.enemyCreature;
      if (enemy.stats.hp > 0) {
        this.executeEnemyMove(data, creature, enemy);
      }
      this.applyEndOfTurnEffects(data, creature, enemy);
      this.checkBattleOutcome(data);
    } else {
      return { success: false, error: 'Unknown item' };
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle: Catch ---

  private handleCatch(data: CreatureRPGState): ActionResult {
    if (data.gamePhase !== 'battle' || !data.battleState) {
      return { success: false, error: 'Not in battle' };
    }
    if (!data.battleState.canCatch) {
      return { success: false, error: 'Cannot catch trainer creatures' };
    }
    if (data.inventory.captureOrbs <= 0) {
      return { success: false, error: 'No capture orbs left' };
    }

    data.inventory.captureOrbs--;
    const enemy = data.battleState.enemyCreature;

    // Catch formula
    const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
    const baseCatchRate = 0.45;
    const statusBonus = enemy.statusEffect
      ? enemy.statusEffect.type === 'paralysis'
        ? 0.25
        : 0.15
      : 0;
    const catchChance = Math.min(0.95, baseCatchRate * (1 - hpRatio * 0.7) + statusBonus);

    if (Math.random() < catchChance) {
      // Caught!
      const speciesName = this.capitalize(enemy.species);
      data.combatLog.push(`Gotcha! ${speciesName} was caught!`);

      if (data.party.length < 3) {
        enemy.statusEffect = null;
        enemy.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0 };
        data.party.push(enemy);
        data.combatLog.push(`${speciesName} joined your party!`);
      } else {
        data.combatLog.push(`Party is full. ${speciesName} was released.`);
      }

      if (!data.caughtSpecies.includes(enemy.species)) {
        data.caughtSpecies.push(enemy.species);
      }
      data.totalCreaturesCaught++;

      // Award XP for catching
      const activeCreature = data.party[data.battleState.activeIndex];
      if (activeCreature && activeCreature.stats.hp > 0) {
        this.awardXp(data, activeCreature, enemy.level, false);
      }

      data.battleState = null;
      data.gamePhase = 'overworld';
      this.emitEvent('creature_caught', this.getPlayers()[0], { species: enemy.species });
    } else {
      data.combatLog.push('The creature broke free!');

      // Enemy gets a turn
      const player = data.party[data.battleState.activeIndex];
      if (enemy.stats.hp > 0 && player.stats.hp > 0) {
        this.executeEnemyMove(data, player, enemy);
      }
      this.applyEndOfTurnEffects(data, player, enemy);
      this.checkBattleOutcome(data);
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle: Flee ---

  private handleFlee(data: CreatureRPGState): ActionResult {
    if (data.gamePhase !== 'battle' || !data.battleState) {
      return { success: false, error: 'Not in battle' };
    }
    if (!data.battleState.canFlee) {
      return { success: false, error: "Can't flee from trainer battles!" };
    }

    const player = data.party[data.battleState.activeIndex];
    const enemy = data.battleState.enemyCreature;
    const playerSpd = getEffectiveStat(player, 'spd');
    const enemySpd = getEffectiveStat(enemy, 'spd');

    const fleeChance = Math.min(
      0.95,
      Math.max(0.3, 0.5 + (playerSpd / Math.max(1, enemySpd) - 1) * 0.25),
    );

    if (Math.random() < fleeChance) {
      data.combatLog.push('Got away safely!');
      data.battleState = null;
      data.gamePhase = 'overworld';
    } else {
      data.combatLog.push("Couldn't escape!");
      // Enemy gets a turn
      if (enemy.stats.hp > 0) {
        this.executeEnemyMove(data, player, enemy);
      }
      this.applyEndOfTurnEffects(data, player, enemy);
      this.checkBattleOutcome(data);
    }

    this.setData(data as Record<string, unknown>);
    return { success: true, newState: this.state };
  }

  // --- Battle Helpers ---

  private executePlayerMove(
    data: CreatureRPGState,
    player: Creature,
    enemy: Creature,
    move: Move,
  ): void {
    if (player.stats.hp <= 0) return;

    // Paralysis skip check
    if (player.statusEffect?.type === 'paralysis' && Math.random() < 0.25) {
      data.combatLog.push(`${this.capitalize(player.species)} is paralyzed and can't move!`);
      return;
    }

    move.pp = Math.max(0, move.pp - 1);

    if (move.category === 'status') {
      this.executeStatusMove(data, player, enemy, move, true);
      return;
    }

    // Accuracy check
    if (Math.random() * 100 > move.accuracy) {
      data.combatLog.push(`${this.capitalize(player.species)} used ${move.name}... but missed!`);
      return;
    }

    const result = calculateDamage(player, enemy, move);

    if (result.effectiveness === 0) {
      data.combatLog.push(
        `${this.capitalize(player.species)} used ${move.name}! It had no effect...`,
      );
      return;
    }

    enemy.stats.hp = Math.max(0, enemy.stats.hp - result.damage);

    let msg = `${this.capitalize(player.species)} used ${move.name}! (-${result.damage} HP)`;
    if (result.effectiveness > 1) msg += " It's super effective!";
    else if (result.effectiveness < 1) msg += " It's not very effective...";
    if (result.critical) msg += ' Critical hit!';
    data.combatLog.push(msg);

    // Status effect proc
    if (move.statusEffect && enemy.stats.hp > 0 && !enemy.statusEffect) {
      if (Math.random() * 100 < move.statusEffect.chance) {
        enemy.statusEffect = { type: move.statusEffect.type, turnsActive: 0 };
        data.combatLog.push(
          `${this.capitalize(enemy.species)} was ${this.statusName(move.statusEffect.type)}!`,
        );
      }
    }
  }

  private executeEnemyMove(data: CreatureRPGState, player: Creature, enemy: Creature): void {
    if (enemy.stats.hp <= 0 || player.stats.hp <= 0) return;

    // Paralysis skip check
    if (enemy.statusEffect?.type === 'paralysis' && Math.random() < 0.25) {
      data.combatLog.push(`${this.capitalize(enemy.species)} is paralyzed and can't move!`);
      return;
    }

    // Enemy AI: pick best available move
    const move = this.pickEnemyMove(enemy, player);
    if (!move || move.pp <= 0) {
      data.combatLog.push(`${this.capitalize(enemy.species)} has no moves left!`);
      return;
    }

    move.pp = Math.max(0, move.pp - 1);

    if (move.category === 'status') {
      this.executeStatusMove(data, enemy, player, move, false);
      return;
    }

    if (Math.random() * 100 > move.accuracy) {
      data.combatLog.push(`${this.capitalize(enemy.species)} used ${move.name}... but missed!`);
      return;
    }

    const result = calculateDamage(enemy, player, move);

    if (result.effectiveness === 0) {
      data.combatLog.push(
        `${this.capitalize(enemy.species)} used ${move.name}! It had no effect...`,
      );
      return;
    }

    player.stats.hp = Math.max(0, player.stats.hp - result.damage);

    let msg = `${this.capitalize(enemy.species)} used ${move.name}! (-${result.damage} HP)`;
    if (result.effectiveness > 1) msg += " It's super effective!";
    else if (result.effectiveness < 1) msg += " It's not very effective...";
    if (result.critical) msg += ' Critical hit!';
    data.combatLog.push(msg);

    // Status effect proc
    if (move.statusEffect && player.stats.hp > 0 && !player.statusEffect) {
      if (Math.random() * 100 < move.statusEffect.chance) {
        player.statusEffect = { type: move.statusEffect.type, turnsActive: 0 };
        data.combatLog.push(
          `${this.capitalize(player.species)} was ${this.statusName(move.statusEffect.type)}!`,
        );
      }
    }
  }

  private executeStatusMove(
    data: CreatureRPGState,
    user: Creature,
    target: Creature,
    move: Move,
    isPlayer: boolean,
  ): void {
    const userName = this.capitalize(user.species);
    const targetName = this.capitalize(target.species);

    if (move.statChange) {
      const affected = move.statChange.target === 'self' ? user : target;
      const affectedName = move.statChange.target === 'self' ? userName : targetName;
      const stat = move.statChange.stat;
      const stages = move.statChange.stages;
      affected.statStages[stat] = Math.max(
        -3,
        Math.min(3, ((affected.statStages[stat] as number) || 0) + stages),
      );
      const direction = stages > 0 ? 'rose' : 'fell';
      data.combatLog.push(
        `${userName} used ${move.name}! ${affectedName}'s ${stat.toUpperCase()} ${direction}!`,
      );
    } else if (move.heals) {
      // Leech Seed
      if (!data.battleState) return;
      data.battleState.leechSeedActive = true;
      data.battleState.leechSeedSource = isPlayer ? 'player' : 'enemy';
      data.combatLog.push(`${userName} used ${move.name}! ${targetName} was seeded!`);
    } else {
      data.combatLog.push(`${userName} used ${move.name}!`);
    }
  }

  private pickEnemyMove(enemy: Creature, player: Creature): Move | null {
    const available = enemy.moves.filter((m) => m.pp > 0);
    if (available.length === 0) return null;

    // Prefer super-effective damaging moves
    const superEffective = available.filter(
      (m) => m.power > 0 && getEffectiveness(m.type, player.type) > 1,
    );
    if (superEffective.length > 0) {
      return superEffective[Math.floor(Math.random() * superEffective.length)];
    }

    // Otherwise pick highest power damaging move
    const damaging = available.filter((m) => m.power > 0);
    if (damaging.length > 0) {
      damaging.sort((a, b) => b.power - a.power);
      // Small random factor to avoid always same move
      return damaging[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * damaging.length)];
    }

    // Fallback to status move
    return available[Math.floor(Math.random() * available.length)];
  }

  private applyEndOfTurnEffects(data: CreatureRPGState, player: Creature, enemy: Creature): void {
    // Player status damage
    if (player.stats.hp > 0 && player.statusEffect) {
      player.statusEffect.turnsActive++;
      if (player.statusEffect.type === 'burn') {
        const dmg = Math.max(1, Math.floor(player.stats.maxHp / 16));
        player.stats.hp = Math.max(0, player.stats.hp - dmg);
        data.combatLog.push(`${this.capitalize(player.species)} took ${dmg} burn damage!`);
      } else if (player.statusEffect.type === 'poison') {
        const dmg = Math.max(1, Math.floor(player.stats.maxHp / 8));
        player.stats.hp = Math.max(0, player.stats.hp - dmg);
        data.combatLog.push(`${this.capitalize(player.species)} took ${dmg} poison damage!`);
      }
    }

    // Enemy status damage
    if (enemy.stats.hp > 0 && enemy.statusEffect) {
      enemy.statusEffect.turnsActive++;
      if (enemy.statusEffect.type === 'burn') {
        const dmg = Math.max(1, Math.floor(enemy.stats.maxHp / 16));
        enemy.stats.hp = Math.max(0, enemy.stats.hp - dmg);
        data.combatLog.push(`${this.capitalize(enemy.species)} took ${dmg} burn damage!`);
      } else if (enemy.statusEffect.type === 'poison') {
        const dmg = Math.max(1, Math.floor(enemy.stats.maxHp / 8));
        enemy.stats.hp = Math.max(0, enemy.stats.hp - dmg);
        data.combatLog.push(`${this.capitalize(enemy.species)} took ${dmg} poison damage!`);
      }
    }

    // Leech seed — drains HP from the seeded target to the source
    if (data.battleState?.leechSeedActive && enemy.stats.hp > 0 && player.stats.hp > 0) {
      const source = data.battleState.leechSeedSource;
      const drainer = source === 'player' ? player : enemy;
      const victim = source === 'player' ? enemy : player;
      const drain = Math.max(1, Math.floor(victim.stats.maxHp / 8));
      victim.stats.hp = Math.max(0, victim.stats.hp - drain);
      drainer.stats.hp = Math.min(drainer.stats.maxHp, drainer.stats.hp + drain);
      data.combatLog.push(
        `Leech Seed drained ${drain} HP from ${this.capitalize(victim.species)}!`,
      );
    }
  }

  private checkBattleOutcome(data: CreatureRPGState): void {
    if (!data.battleState) return;
    const bs = data.battleState;
    const player = data.party[bs.activeIndex];
    const enemy = bs.enemyCreature;

    // Enemy fainted
    if (enemy.stats.hp <= 0) {
      data.combatLog.push(`${this.capitalize(enemy.species)} fainted!`);
      data.totalBattlesWon++;

      // Award XP
      if (player && player.stats.hp > 0) {
        this.awardXp(data, player, enemy.level, bs.type !== 'wild');
      }

      // Trainer: next creature?
      if (bs.type !== 'wild' && bs.enemyPartyIndex < bs.enemyParty.length - 1) {
        bs.enemyPartyIndex++;
        bs.enemyCreature = bs.enemyParty[bs.enemyPartyIndex];
        bs.leechSeedActive = false;
        data.combatLog.push(
          `${bs.trainerName} sent out ${this.capitalize(bs.enemyCreature.species)}!`,
        );
        return;
      }

      // Battle won
      if (bs.trainerId) {
        data.defeatedTrainers.push(bs.trainerId);
        data.combatLog.push(`Defeated ${bs.trainerName}!`);
        this.emitEvent('trainer_defeated', this.getPlayers()[0], { trainer: bs.trainerName });

        if (bs.trainerId === 'gym_leader') {
          data.gymDefeated = true;
          data.combatLog.push('You earned the Verdant Badge! Congratulations!');
          data.gamePhase = 'victory';
          data.battleState = null;
          this.emitEvent('gym_defeated', this.getPlayers()[0]);
          return;
        }
      }

      data.battleState = null;
      data.gamePhase = 'overworld';
      return;
    }

    // Player creature fainted
    if (player && player.stats.hp <= 0) {
      data.combatLog.push(`${this.capitalize(player.species)} fainted!`);

      // Check for alive party members
      const nextAlive = this.getFirstAliveIndex(data);
      if (nextAlive === -1) {
        data.combatLog.push('All your creatures have fainted...');
        data.gamePhase = 'defeat';
        data.battleState = null;
        return;
      }

      // Auto-switch to next alive
      bs.activeIndex = nextAlive;
      data.activeCreatureIndex = nextAlive;
      bs.leechSeedActive = false;
      data.combatLog.push(`Go, ${this.capitalize(data.party[nextAlive].species)}!`);
    }
  }

  private startTrainerBattle(
    data: CreatureRPGState,
    trainerId: string,
    type: 'trainer' | 'gym',
  ): void {
    const npc = NPC_DEFS.find((n) => n.id === trainerId);
    if (!npc || !npc.party) return;

    const enemyParty = npc.party.map((p) => createCreature(p.species, p.level));

    const activeIndex = this.getFirstAliveIndex(data);
    if (activeIndex === -1) {
      // All creatures fainted — cannot start battle
      data.gamePhase = 'defeat';
      return;
    }

    data.battleState = {
      type,
      activeIndex,
      enemyCreature: enemyParty[0],
      enemyParty,
      enemyPartyIndex: 0,
      canCatch: false,
      canFlee: false,
      trainerId: npc.id,
      trainerName: npc.name,
      turnCount: 0,
      leechSeedActive: false,
      leechSeedSource: null,
      message: `${npc.name} wants to battle!`,
      awaitingAction: true,
    };
    data.gamePhase = 'battle';
    data.activeCreatureIndex = activeIndex;
    this.emitEvent('battle_started', this.getPlayers()[0], { trainer: npc.name });
  }

  private awardXp(
    data: CreatureRPGState,
    creature: Creature,
    enemyLevel: number,
    isTrainer: boolean,
  ): void {
    const xp = xpFromBattle(enemyLevel, isTrainer);
    creature.xp += xp;
    data.combatLog.push(`${this.capitalize(creature.species)} gained ${xp} XP!`);

    // Check for level up
    while (creature.xp >= creature.xpToLevel && creature.level < 20) {
      creature.xp -= creature.xpToLevel;
      creature.level++;
      creature.xpToLevel = xpForLevel(creature.level + 1);

      // Recalculate stats
      const speciesData = SPECIES[creature.species];
      if (speciesData) {
        const newMaxHp = calcHpForLevel(speciesData.baseStats.hp, creature.level);
        const hpGain = newMaxHp - creature.stats.maxHp;
        creature.stats.maxHp = newMaxHp;
        creature.stats.hp += hpGain; // Gain the difference
        creature.stats.atk = calcStatForLevel(speciesData.baseStats.atk, creature.level);
        creature.stats.def = calcStatForLevel(speciesData.baseStats.def, creature.level);
        creature.stats.spatk = calcStatForLevel(speciesData.baseStats.spatk, creature.level);
        creature.stats.spdef = calcStatForLevel(speciesData.baseStats.spdef, creature.level);
        creature.stats.spd = calcStatForLevel(speciesData.baseStats.spd, creature.level);
      }

      data.combatLog.push(`${this.capitalize(creature.species)} grew to level ${creature.level}!`);
      this.emitEvent('level_up', this.getPlayers()[0], {
        species: creature.species,
        level: creature.level,
      });
    }
  }

  private healParty(data: CreatureRPGState): void {
    for (const c of data.party) {
      c.stats.hp = c.stats.maxHp;
      c.statusEffect = null;
      c.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0 };
      for (const m of c.moves) {
        m.pp = m.maxPp;
      }
    }
  }

  private getFirstAliveIndex(data: CreatureRPGState): number {
    for (let i = 0; i < data.party.length; i++) {
      if (data.party[i].stats.hp > 0) return i;
    }
    return -1;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private statusName(type: string): string {
    switch (type) {
      case 'burn':
        return 'burned';
      case 'poison':
        return 'poisoned';
      case 'paralysis':
        return 'paralyzed';
      default:
        return type;
    }
  }

  // --- Game Over ---

  protected checkGameOver(): boolean {
    const data = this.getData<CreatureRPGState>();
    return data.gamePhase === 'victory' || data.gamePhase === 'defeat';
  }

  protected determineWinner(): string | null {
    const data = this.getData<CreatureRPGState>();
    return data.gymDefeated ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CreatureRPGState>();
    let score = 0;
    score += data.totalBattlesWon * 50;
    score += data.totalCreaturesCaught * 100;
    if (data.gymDefeated) score += 500;
    const totalMaxHp = data.party.reduce((s, c) => s + c.stats.maxHp, 0);
    const totalHp = data.party.reduce((s, c) => s + Math.max(0, c.stats.hp), 0);
    if (totalMaxHp > 0) score += Math.floor((totalHp / totalMaxHp) * 200);
    const totalLevels = data.party.reduce((s, c) => s + c.level, 0);
    score += totalLevels * 10;
    // Efficiency bonus: fewer steps = higher score. No penalty if > 500 steps
    // (Math.max clamps to 0). This rewards speedrunners without punishing exploration.
    score += Math.max(0, (500 - data.totalSteps) * 2);
    score += data.caughtSpecies.length * 75;
    return { [this.getPlayers()[0]]: score };
  }

  // --- Fog of War ---

  override getStateForPlayer(playerId: string) {
    const state = super.getStateForPlayer(playerId);
    // Hide enemy move PP from player (adds uncertainty)
    const data = state.data as CreatureRPGState;
    if (data.battleState?.enemyCreature) {
      const sanitized = { ...data.battleState.enemyCreature };
      sanitized.moves = sanitized.moves.map((m) => ({ ...m, pp: -1, maxPp: -1 }));
      (state.data as CreatureRPGState).battleState = {
        ...data.battleState,
        enemyCreature: sanitized,
      };
    }
    return state;
  }
}

// Export helpers for testing
export {
  createCreature,
  calculateDamage,
  getEffectiveness,
  calcHpForLevel,
  calcStatForLevel,
  xpForLevel,
  xpFromBattle,
  getEffectiveStat,
  SPECIES,
  VALID_STARTERS,
  TYPE_CHART,
  MAPS,
  NPC_DEFS,
  ENCOUNTER_RATE,
  T,
};

export type {
  Creature,
  CreatureType,
  CreatureStats,
  Move,
  StatusEffect,
  BattleState,
  CreatureRPGState,
  Inventory,
};
