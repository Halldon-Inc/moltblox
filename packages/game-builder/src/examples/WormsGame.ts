/**
 * WormsGame - Worms Armageddon-style artillery combat
 *
 * Turn-based 2D combat with destructible terrain, projectile physics,
 * 20 weapons, NPC opponents, and sudden death mechanics.
 *
 * Modes:
 * - FFA: 2-4 players, last team standing wins
 * - Teams: 2v2 or 2-team alliances
 * - Deathmatch: Solo player vs increasingly tough NPC waves
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WormsConfig {
  mode?: 'ffa' | 'teams' | 'deathmatch';
  wormsPerPlayer?: number;
  startingHp?: number;
  turnTimeSeconds?: number;
  retreatTimeSeconds?: number;
  roundTimeSeconds?: number;
  fallDamage?: boolean;
  windEnabled?: boolean;
  crateFrequency?: number;
  healthCrateAmount?: number;
  suddenDeathType?: 'water-rise' | 'one-hp' | 'nuke';
  waterRiseSpeed?: 'slow' | 'medium' | 'fast';
  mapWidth?: number;
  mapHeight?: number;
  mapSeed?: number;
  npcFillEnabled?: boolean;
  maxPlayers?: number;
  teamCount?: number;
  theme?: {
    teamColors?: string[];
    wormNames?: string[];
    skyGradient?: [string, string];
    terrainColors?: string[];
    waterColor?: string;
  };
  gameplay?: {
    gravity?: number;
    walkSpeed?: number;
    jumpForce?: number;
    knockbackForce?: number;
    safeHeight?: number;
    fallDamageMultiplier?: number;
  };
  content?: {
    weapons?: Partial<Record<string, Partial<WeaponDef>>>;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vec2 {
  x: number;
  y: number;
  [key: string]: unknown;
}

interface Worm {
  id: string;
  playerId: string;
  teamId: number;
  name: string;
  position: Vec2;
  hp: number;
  maxHp: number;
  alive: boolean;
  facingRight: boolean;
  velocity: Vec2;
  onRope: boolean;
  [key: string]: unknown;
}

interface Projectile {
  id: string;
  weaponSlug: string;
  position: Vec2;
  velocity: Vec2;
  fuse: number;
  bounciness: number;
  trail: Vec2[];
  active: boolean;
  ownerId: string;
  [key: string]: unknown;
}

interface Crate {
  id: string;
  position: Vec2;
  type: 'weapon' | 'health' | 'utility';
  content: string;
  falling: boolean;
  parachuteY: number;
  [key: string]: unknown;
}

interface PlayerData {
  id: string;
  teamId: number;
  isNPC: boolean;
  wormIds: string[];
  alive: boolean;
  weapons: Record<string, number>;
  wormCycleIndex: number;
  [key: string]: unknown;
}

interface WormsState {
  terrain: number[];
  terrainWidth: number;
  terrainHeight: number;
  players: Record<string, PlayerData>;
  worms: Record<string, Worm>;
  turnOrder: string[];
  currentTurnIndex: number;
  activeWormId: string | null;
  turnPhase: 'moving' | 'aiming' | 'retreat' | 'resolving' | 'between_turns';
  turnStartedAt: number;
  hasFiredThisTurn: boolean;
  retreatStartedAt: number;
  shotsFiredThisTurn: number;
  wind: number;
  waterLevel: number;
  suddenDeath: boolean;
  roundTimeRemaining: number;
  roundNumber: number;
  projectiles: Projectile[];
  crates: Crate[];
  gameOver: boolean;
  turnCount: number;
  mode: string;
  selectedWeapon: string;
  aimAngle: number;
  power: number;
  fuseTimer: number;
  crateIdCounter: number;
  projIdCounter: number;
  config: WormsConfig;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Weapon definitions
// ---------------------------------------------------------------------------

interface WeaponDef {
  name: string;
  damage: number;
  radius: number;
  type:
    | 'projectile'
    | 'thrown'
    | 'hitscan'
    | 'placed'
    | 'airstrike'
    | 'melee'
    | 'utility'
    | 'cluster'
    | 'homing';
  defaultAmmo: number;
  speed: number;
  gravity: boolean;
  windAffected: boolean;
  fuse: number;
  bounces: boolean;
  bounciness: number;
  shots: number;
  clusters: number;
  clusterDamage: number;
  endsTurn: boolean;
}

const WEAPONS: Record<string, WeaponDef> = {
  bazooka: {
    name: 'Bazooka',
    damage: 50,
    radius: 25,
    type: 'projectile',
    defaultAmmo: -1,
    speed: 8,
    gravity: true,
    windAffected: true,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'homing-missile': {
    name: 'Homing Missile',
    damage: 50,
    radius: 25,
    type: 'homing',
    defaultAmmo: 1,
    speed: 7,
    gravity: true,
    windAffected: true,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  grenade: {
    name: 'Grenade',
    damage: 50,
    radius: 25,
    type: 'thrown',
    defaultAmmo: -1,
    speed: 7,
    gravity: true,
    windAffected: false,
    fuse: 3,
    bounces: true,
    bounciness: 0.4,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'cluster-bomb': {
    name: 'Cluster Bomb',
    damage: 50,
    radius: 20,
    type: 'cluster',
    defaultAmmo: 2,
    speed: 7,
    gravity: true,
    windAffected: false,
    fuse: 3,
    bounces: true,
    bounciness: 0.4,
    shots: 1,
    clusters: 5,
    clusterDamage: 15,
    endsTurn: true,
  },
  'banana-bomb': {
    name: 'Banana Bomb',
    damage: 75,
    radius: 30,
    type: 'cluster',
    defaultAmmo: 1,
    speed: 6,
    gravity: true,
    windAffected: false,
    fuse: 3,
    bounces: true,
    bounciness: 0.35,
    shots: 1,
    clusters: 5,
    clusterDamage: 75,
    endsTurn: true,
  },
  'holy-hand-grenade': {
    name: 'Holy Hand Grenade',
    damage: 100,
    radius: 55,
    type: 'thrown',
    defaultAmmo: 1,
    speed: 5,
    gravity: true,
    windAffected: false,
    fuse: 3,
    bounces: true,
    bounciness: 0.2,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  shotgun: {
    name: 'Shotgun',
    damage: 25,
    radius: 0,
    type: 'hitscan',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 2,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'fire-punch': {
    name: 'Fire Punch',
    damage: 30,
    radius: 0,
    type: 'melee',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  dynamite: {
    name: 'Dynamite',
    damage: 75,
    radius: 40,
    type: 'placed',
    defaultAmmo: 1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: 5,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  mine: {
    name: 'Mine',
    damage: 25,
    radius: 20,
    type: 'placed',
    defaultAmmo: 2,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: 3,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  airstrike: {
    name: 'Airstrike',
    damage: 30,
    radius: 20,
    type: 'airstrike',
    defaultAmmo: 1,
    speed: 10,
    gravity: true,
    windAffected: true,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 5,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'napalm-strike': {
    name: 'Napalm Strike',
    damage: 50,
    radius: 30,
    type: 'airstrike',
    defaultAmmo: 1,
    speed: 10,
    gravity: true,
    windAffected: true,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 5,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  blowtorch: {
    name: 'Blowtorch',
    damage: 15,
    radius: 0,
    type: 'utility',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  drill: {
    name: 'Pneumatic Drill',
    damage: 15,
    radius: 0,
    type: 'utility',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  teleport: {
    name: 'Teleport',
    damage: 0,
    radius: 0,
    type: 'utility',
    defaultAmmo: 2,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'ninja-rope': {
    name: 'Ninja Rope',
    damage: 0,
    radius: 0,
    type: 'utility',
    defaultAmmo: 5,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: false,
  },
  girder: {
    name: 'Girder',
    damage: 0,
    radius: 0,
    type: 'utility',
    defaultAmmo: 2,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'baseball-bat': {
    name: 'Baseball Bat',
    damage: 30,
    radius: 0,
    type: 'melee',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  prod: {
    name: 'Prod',
    damage: 0,
    radius: 0,
    type: 'melee',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  skip: {
    name: 'Skip Turn',
    damage: 0,
    radius: 0,
    type: 'utility',
    defaultAmmo: -1,
    speed: 0,
    gravity: false,
    windAffected: false,
    fuse: -1,
    bounces: false,
    bounciness: 0,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  // Internal cluster sub-projectile types (non-cascading)
  'banana-cluster': {
    name: 'Banana Fragment',
    damage: 75,
    radius: 25,
    type: 'thrown',
    defaultAmmo: 0,
    speed: 4,
    gravity: true,
    windAffected: false,
    fuse: 1.5,
    bounces: true,
    bounciness: 0.3,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
  'grenade-cluster': {
    name: 'Cluster Fragment',
    damage: 15,
    radius: 15,
    type: 'thrown',
    defaultAmmo: 0,
    speed: 4,
    gravity: true,
    windAffected: false,
    fuse: 1.5,
    bounces: true,
    bounciness: 0.3,
    shots: 1,
    clusters: 0,
    clusterDamage: 0,
    endsTurn: true,
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_GRAVITY = 0.15;
const WIND_FACTOR = 0.001;
const DEFAULT_KNOCKBACK_FORCE = 0.15;
const DEFAULT_SAFE_FALL_HEIGHT = 25;
const DEFAULT_FALL_DAMAGE_MULT = 0.5;
const DEFAULT_WALK_SPEED = 2;
const DEFAULT_JUMP_FORCE = 4;
const JUMP_FORWARD_VX = 3;
const BACKFLIP_VX = -1.5;
const MELEE_RANGE = 30;
const MELEE_KNOCKBACK = 8;
const BAT_KNOCKBACK = 14;
const PROD_KNOCKBACK = 2;
const BLOWTORCH_LENGTH = 40;
const DRILL_DEPTH = 50;
const MAX_PROJECTILE_TICKS = 300;

const DEFAULT_NPC_WORM_NAMES = [
  'Boggy',
  'Spadge',
  'Wormsworth',
  'Sir Wormsalot',
  'Captain Kaboom',
  'Private Partz',
  'Sergeant Squirm',
  'Baron von Splat',
  'El Nibblo',
  'Professor Boom',
  'Colonel Crawly',
  'The Mole King',
  'Admiral Oopsie',
  'General Wiggles',
  'Duke Splatington',
  'Major Malfunction',
  'Corporal Carnage',
  'Lieutenant Lob',
  'Ensign Kablammo',
  'Squirmy McSquirmface',
  'Nitro Noodle',
  'Dynamite Dan',
  'Boom Boom Betty',
  'Grenade Gary',
  'Torpedo Ted',
  'Rocket Rita',
];

const DEFAULT_HUMAN_WORM_NAMES = [
  'Ace',
  'Blaze',
  'Spike',
  'Tank',
  'Flash',
  'Storm',
  'Rocket',
  'Nitro',
  'Turbo',
  'Fury',
  'Bolt',
  'Rex',
];

// ---------------------------------------------------------------------------
// Seeded random (for deterministic terrain)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// WormsGame
// ---------------------------------------------------------------------------

export class WormsGame extends BaseGame {
  readonly name = 'Worms';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private getWeaponDef(slug: string): WeaponDef | undefined {
    const base = WEAPONS[slug];
    if (!base) return undefined;
    const cfg = this.config as WormsConfig;
    const overrides = cfg.content?.weapons?.[slug];
    if (!overrides) return base;
    return { ...base, ...overrides };
  }

  private getPhysics() {
    const cfg = this.config as WormsConfig;
    return {
      gravity: (cfg.gameplay?.gravity as number) ?? DEFAULT_GRAVITY,
      walkSpeed: (cfg.gameplay?.walkSpeed as number) ?? DEFAULT_WALK_SPEED,
      jumpForce: (cfg.gameplay?.jumpForce as number) ?? DEFAULT_JUMP_FORCE,
      knockbackForce: (cfg.gameplay?.knockbackForce as number) ?? DEFAULT_KNOCKBACK_FORCE,
      safeHeight: (cfg.gameplay?.safeHeight as number) ?? DEFAULT_SAFE_FALL_HEIGHT,
      fallDamageMultiplier:
        (cfg.gameplay?.fallDamageMultiplier as number) ?? DEFAULT_FALL_DAMAGE_MULT,
    };
  }

  protected initializeState(playerIds: string[]): WormsState {
    const cfg = this.config as WormsConfig;
    const mode = cfg.mode ?? 'ffa';
    const wormsPerPlayer = Math.max(1, Math.min(6, cfg.wormsPerPlayer ?? 4));
    const startingHp = Math.max(1, Math.min(255, cfg.startingHp ?? 100));
    const maxPlayers = Math.max(2, Math.min(4, cfg.maxPlayers ?? 4));
    const mapWidth = cfg.mapWidth ?? 1600;
    const mapHeight = cfg.mapHeight ?? 800;
    const seed = cfg.mapSeed ?? Math.floor(Math.random() * 999999);

    // Build player list with NPC fill
    const allPlayerIds = [...playerIds];
    const npcPlayerIds: string[] = [];
    if (cfg.npcFillEnabled !== false && allPlayerIds.length < maxPlayers) {
      const npcCount = maxPlayers - allPlayerIds.length;
      for (let i = 0; i < npcCount; i++) {
        const npcId = `npc_${i}`;
        allPlayerIds.push(npcId);
        npcPlayerIds.push(npcId);
      }
    }

    // Generate terrain
    const terrain = this.generateTerrain(mapWidth, mapHeight, seed);

    // Build default weapons inventory
    const defaultWeapons: Record<string, number> = {};
    for (const [slug, def] of Object.entries(WEAPONS)) {
      defaultWeapons[slug] = def.defaultAmmo;
    }

    // Assign teams
    const teamCount =
      mode === 'teams' ? Math.max(2, Math.min(4, cfg.teamCount ?? 2)) : allPlayerIds.length;

    // Create players and worms
    const players: Record<string, PlayerData> = {};
    const worms: Record<string, Worm> = {};
    const rng = seededRandom(seed + 42);
    let namePoolIndex = 0;

    const customNames = cfg.theme?.wormNames as string[] | undefined;

    for (let i = 0; i < allPlayerIds.length; i++) {
      const pid = allPlayerIds[i];
      const isNPC = pid.startsWith('npc_');
      const teamId = mode === 'teams' ? i % teamCount : i;
      const wormIds: string[] = [];
      const namePool = customNames ?? (isNPC ? DEFAULT_NPC_WORM_NAMES : DEFAULT_HUMAN_WORM_NAMES);

      for (let w = 0; w < wormsPerPlayer; w++) {
        const wormId = `${pid}_w${w}`;
        wormIds.push(wormId);

        // Spread worms across the map
        const spawnSection = mapWidth / allPlayerIds.length;
        const spawnX = Math.floor(
          spawnSection * i + spawnSection * 0.2 + rng() * spawnSection * 0.6,
        );
        const spawnY = this.findGroundLevel(terrain, mapWidth, spawnX) - 1;

        worms[wormId] = {
          id: wormId,
          playerId: pid,
          teamId,
          name: namePool[namePoolIndex % namePool.length],
          position: { x: spawnX, y: spawnY },
          hp: startingHp,
          maxHp: startingHp,
          alive: true,
          facingRight: i < allPlayerIds.length / 2,
          velocity: { x: 0, y: 0 },
          onRope: false,
        };
        namePoolIndex++;
      }

      players[pid] = {
        id: pid,
        teamId,
        isNPC,
        wormIds,
        alive: true,
        weapons: { ...defaultWeapons },
        wormCycleIndex: 0,
      };
    }

    // Turn order: shuffle player IDs
    const turnOrder = [...allPlayerIds];
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    // Select first active worm
    const firstPlayer = players[turnOrder[0]];
    const firstAliveWorm = firstPlayer.wormIds.find((wid) => worms[wid]?.alive);

    const state: WormsState = {
      terrain,
      terrainWidth: mapWidth,
      terrainHeight: mapHeight,
      players,
      worms,
      turnOrder,
      currentTurnIndex: 0,
      activeWormId: firstAliveWorm ?? null,
      turnPhase: 'moving',
      turnStartedAt: Date.now(),
      hasFiredThisTurn: false,
      retreatStartedAt: 0,
      shotsFiredThisTurn: 0,
      wind: Math.round((Math.random() - 0.5) * 200),
      waterLevel: mapHeight - 40,
      suddenDeath: false,
      roundTimeRemaining: cfg.roundTimeSeconds ?? 600,
      roundNumber: 1,
      projectiles: [],
      crates: [],
      gameOver: false,
      turnCount: 0,
      mode,
      selectedWeapon: 'bazooka',
      aimAngle: 0,
      power: 50,
      fuseTimer: 3,
      crateIdCounter: 0,
      projIdCounter: 0,
      config: cfg,
    };

    this.emitEvent('turn_start', turnOrder[0], {
      activeWorm: state.activeWormId,
      wind: state.wind,
      turnNumber: 0,
    });

    // If first player is NPC, auto-execute
    if (firstPlayer.isNPC) {
      this.executeNPCTurn(state);
    }

    return state;
  }

  // -------------------------------------------------------------------------
  // Action processing
  // -------------------------------------------------------------------------

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WormsState>();

    if (data.gameOver) {
      return { success: false, error: 'Game is over' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(playerId, action, data);
      case 'jump':
        return this.handleJump(playerId, action, data);
      case 'aim':
        return this.handleAim(playerId, action, data);
      case 'select_weapon':
        return this.handleSelectWeapon(playerId, action, data);
      case 'set_fuse':
        return this.handleSetFuse(playerId, action, data);
      case 'fire':
        return this.handleFire(playerId, action, data);
      case 'use_item':
        return this.handleUseItem(playerId, action, data);
      case 'end_turn':
        return this.handleEndTurn(playerId, data);
      case 'tick':
        return this.handleTick(data);
      case 'npc_turn':
        return this.handleNPCTurn(data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  private handleMove(playerId: string, action: GameAction, data: WormsState): ActionResult {
    if (!this.isPlayerTurn(playerId, data)) {
      return { success: false, error: 'Not your turn' };
    }
    if (data.turnPhase !== 'moving' && data.turnPhase !== 'retreat') {
      return { success: false, error: 'Cannot move in this phase' };
    }

    const worm = data.activeWormId ? data.worms[data.activeWormId] : null;
    if (!worm || !worm.alive) return { success: false, error: 'No active worm' };

    const dir = action.payload.direction === 'left' ? -1 : 1;
    worm.facingRight = dir > 0;
    const physics = this.getPhysics();

    const newX = worm.position.x + dir * physics.walkSpeed;
    if (newX < 0 || newX >= data.terrainWidth) {
      return { success: false, error: 'Out of bounds' };
    }

    const groundY = this.findGroundLevel(data.terrain, data.terrainWidth, Math.floor(newX));
    const currentGround = this.findGroundLevel(
      data.terrain,
      data.terrainWidth,
      Math.floor(worm.position.x),
    );

    // Can climb up to 4 pixels vertically
    if (currentGround - groundY > 4) {
      return { success: false, error: 'Slope too steep' };
    }

    worm.position.x = newX;
    worm.position.y = groundY - 1;

    // Collect crates
    this.checkCrateCollection(worm, data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleJump(playerId: string, action: GameAction, data: WormsState): ActionResult {
    if (!this.isPlayerTurn(playerId, data)) {
      return { success: false, error: 'Not your turn' };
    }
    if (data.turnPhase !== 'moving' && data.turnPhase !== 'retreat') {
      return { success: false, error: 'Cannot jump in this phase' };
    }

    const worm = data.activeWormId ? data.worms[data.activeWormId] : null;
    if (!worm || !worm.alive) return { success: false, error: 'No active worm' };
    if (worm.velocity.x !== 0 || worm.velocity.y !== 0) {
      return { success: false, error: 'Already airborne' };
    }

    const jumpType = action.payload.type ?? 'forward';
    const dir = worm.facingRight ? 1 : -1;
    const physics = this.getPhysics();
    const jumpVY = -physics.jumpForce;

    if (jumpType === 'backflip') {
      worm.velocity.x = BACKFLIP_VX * dir;
      worm.velocity.y = jumpVY * 1.5;
    } else {
      worm.velocity.x = JUMP_FORWARD_VX * dir;
      worm.velocity.y = jumpVY;
    }

    this.emitEvent('worm_jump', playerId, { wormId: worm.id, type: jumpType });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleAim(_playerId: string, action: GameAction, data: WormsState): ActionResult {
    const angle = Number(action.payload.angle);
    if (isNaN(angle)) return { success: false, error: 'Invalid angle' };
    data.aimAngle = angle;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSelectWeapon(playerId: string, action: GameAction, data: WormsState): ActionResult {
    if (!this.isPlayerTurn(playerId, data)) {
      return { success: false, error: 'Not your turn' };
    }
    const slug = String(action.payload.weapon ?? '');
    if (!this.getWeaponDef(slug)) return { success: false, error: 'Unknown weapon' };

    const player = data.players[playerId];
    if (!player) return { success: false, error: 'Unknown player' };
    if (player.weapons[slug] === 0) return { success: false, error: 'No ammo' };

    data.selectedWeapon = slug;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSetFuse(_playerId: string, action: GameAction, data: WormsState): ActionResult {
    const fuse = Number(action.payload.fuse);
    if (isNaN(fuse) || fuse < 1 || fuse > 5) {
      return { success: false, error: 'Fuse must be 1-5' };
    }
    data.fuseTimer = fuse;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFire(playerId: string, action: GameAction, data: WormsState): ActionResult {
    if (!this.isPlayerTurn(playerId, data)) {
      return { success: false, error: 'Not your turn' };
    }
    if (data.hasFiredThisTurn) {
      return { success: false, error: 'Already fired this turn' };
    }
    if (data.turnPhase === 'retreat' || data.turnPhase === 'resolving') {
      return { success: false, error: 'Cannot fire in this phase' };
    }

    const worm = data.activeWormId ? data.worms[data.activeWormId] : null;
    if (!worm || !worm.alive) return { success: false, error: 'No active worm' };

    const weaponSlug = action.payload.weapon ? String(action.payload.weapon) : data.selectedWeapon;
    const weapon = this.getWeaponDef(weaponSlug);
    if (!weapon) return { success: false, error: 'Unknown weapon' };

    const player = data.players[playerId];
    if (!player) return { success: false, error: 'Unknown player' };
    if (player.weapons[weaponSlug] === 0) return { success: false, error: 'No ammo' };

    const angle = action.payload.angle != null ? Number(action.payload.angle) : data.aimAngle;
    const power =
      action.payload.power != null
        ? Math.max(0, Math.min(100, Number(action.payload.power)))
        : data.power;

    // Consume ammo (-1 means infinite)
    if (player.weapons[weaponSlug] > 0) {
      player.weapons[weaponSlug]--;
    }

    data.selectedWeapon = weaponSlug;
    data.aimAngle = angle;
    data.power = power;

    // Handle different weapon types
    if (weapon.type === 'hitscan') {
      this.fireHitscan(worm, weapon, weaponSlug, angle, data);
    } else if (weapon.type === 'melee') {
      this.fireMelee(worm, weapon, weaponSlug, data);
    } else if (weapon.type === 'placed') {
      this.firePlaced(worm, weapon, weaponSlug, data);
    } else if (weapon.type === 'airstrike') {
      const targetX =
        action.payload.targetX != null
          ? Number(action.payload.targetX)
          : worm.position.x + (worm.facingRight ? 100 : -100);
      this.fireAirstrike(weapon, weaponSlug, targetX, worm.id, data);
    } else if (weapon.type === 'utility') {
      return this.fireUtility(playerId, worm, weapon, weaponSlug, action, data);
    } else {
      // Projectile, thrown, cluster, homing
      this.fireProjectile(worm, weapon, weaponSlug, angle, power, data);
    }

    data.hasFiredThisTurn = true;
    data.shotsFiredThisTurn = 1;

    if (weapon.endsTurn) {
      data.turnPhase = 'retreat';
      data.retreatStartedAt = Date.now();
    }

    this.emitEvent('weapon_fire', playerId, {
      weapon: weaponSlug,
      angle,
      power,
      wormId: worm.id,
    });

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUseItem(playerId: string, action: GameAction, data: WormsState): ActionResult {
    return this.handleFire(
      playerId,
      {
        ...action,
        type: 'fire',
        payload: { ...action.payload, weapon: action.payload.item },
      },
      data,
    );
  }

  private handleEndTurn(playerId: string, data: WormsState): ActionResult {
    if (!this.isPlayerTurn(playerId, data)) {
      return { success: false, error: 'Not your turn' };
    }
    this.advanceTurn(data);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  // -------------------------------------------------------------------------
  // Physics tick
  // -------------------------------------------------------------------------

  private handleTick(data: WormsState): ActionResult {
    const cfg = data.config;

    // Check turn timer
    const elapsed = Date.now() - data.turnStartedAt;
    const turnMs = (cfg.turnTimeSeconds ?? 45) * 1000;
    if ((data.turnPhase === 'moving' || data.turnPhase === 'aiming') && elapsed > turnMs) {
      this.emitEvent('turn_timeout', data.turnOrder[data.currentTurnIndex], {});
      data.turnPhase = 'resolving';
    }

    // Check retreat timer
    if (data.turnPhase === 'retreat') {
      const retreatElapsed = Date.now() - data.retreatStartedAt;
      const retreatMs = (cfg.retreatTimeSeconds ?? 3) * 1000;
      if (retreatElapsed > retreatMs) {
        data.turnPhase = 'resolving';
      }
    }

    // Resolve active projectiles
    const newProjectiles: Projectile[] = [];
    for (const proj of data.projectiles) {
      if (!proj.active) continue;
      this.resolveProjectile(proj, data, newProjectiles);
    }
    data.projectiles = [...data.projectiles.filter((p) => p.active), ...newProjectiles];

    // Apply gravity and settle worms
    let anyWormMoving = false;
    for (const worm of Object.values(data.worms)) {
      if (!worm.alive) continue;
      if (worm.velocity.x !== 0 || worm.velocity.y !== 0) {
        anyWormMoving = true;
        this.resolveWormPhysics(worm, data);
      }
    }

    // Drop falling crates
    for (const crate of data.crates) {
      if (crate.falling) {
        crate.position.y += 1;
        const ground = this.findGroundLevel(
          data.terrain,
          data.terrainWidth,
          Math.floor(crate.position.x),
        );
        if (crate.position.y >= ground - 1) {
          crate.position.y = ground - 1;
          crate.falling = false;
        }
        if (crate.position.y >= data.waterLevel) {
          // Crate fell in water, remove it
          crate.position.y = -100;
          crate.falling = false;
        }
      }
    }
    data.crates = data.crates.filter((c) => c.position.y >= 0);

    // Check if resolving is complete
    if (data.turnPhase === 'resolving') {
      const activeProj = data.projectiles.some((p) => p.active);
      if (!activeProj && !anyWormMoving) {
        data.turnPhase = 'between_turns';
        // Update player alive status
        for (const player of Object.values(data.players)) {
          player.alive = player.wormIds.some((wid) => data.worms[wid]?.alive);
        }
        // Check game over
        if (this.checkWinCondition(data)) {
          data.gameOver = true;
        } else {
          this.advanceTurn(data);
        }
      }
    }

    // Decrement round time
    if (!data.suddenDeath) {
      data.roundTimeRemaining -= 1 / 30; // ~30 ticks per second
      if (data.roundTimeRemaining <= 0) {
        this.triggerSuddenDeath(data);
      }
    } else if (cfg.suddenDeathType === 'water-rise' || cfg.suddenDeathType == null) {
      const riseAmount =
        cfg.waterRiseSpeed === 'fast' ? 0.15 : cfg.waterRiseSpeed === 'slow' ? 0.03 : 0.07;
      data.waterLevel -= riseAmount;
      // Drown worms under water
      for (const worm of Object.values(data.worms)) {
        if (worm.alive && worm.position.y >= data.waterLevel) {
          worm.alive = false;
          worm.hp = 0;
          this.emitEvent('worm_drowned', worm.playerId, { wormId: worm.id, wormName: worm.name });
        }
      }
    } else if (cfg.suddenDeathType === 'nuke') {
      // Poison: 1 damage per ~2 seconds (every 60 ticks)
      if (Math.floor(data.turnCount * 30) % 60 === 0) {
        for (const worm of Object.values(data.worms)) {
          if (worm.alive) {
            worm.hp = Math.max(0, worm.hp - 1);
            if (worm.hp <= 0) {
              worm.alive = false;
              this.emitEvent('worm_poisoned', worm.playerId, { wormId: worm.id });
            }
          }
        }
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  /**
   * Single physics tick: projectile flight, worm settling, crate drops,
   * resolving check, and sudden death. Used by handleNPCTurn to auto-resolve
   * NPC turns server-side in one action.
   */
  private resolveTick(data: WormsState): void {
    const cfg = data.config;

    const newProjectiles: Projectile[] = [];
    for (const proj of data.projectiles) {
      if (!proj.active) continue;
      this.resolveProjectile(proj, data, newProjectiles);
    }
    data.projectiles = [...data.projectiles.filter((p) => p.active), ...newProjectiles];

    let anyWormMoving = false;
    for (const worm of Object.values(data.worms)) {
      if (!worm.alive) continue;
      if (worm.velocity.x !== 0 || worm.velocity.y !== 0) {
        anyWormMoving = true;
        this.resolveWormPhysics(worm, data);
      }
    }

    for (const crate of data.crates) {
      if (crate.falling) {
        crate.position.y += 1;
        const ground = this.findGroundLevel(
          data.terrain,
          data.terrainWidth,
          Math.floor(crate.position.x),
        );
        if (crate.position.y >= ground - 1) {
          crate.position.y = ground - 1;
          crate.falling = false;
        }
        if (crate.position.y >= data.waterLevel) {
          crate.position.y = -100;
          crate.falling = false;
        }
      }
    }
    data.crates = data.crates.filter((c) => c.position.y >= 0);

    if (data.turnPhase === 'resolving') {
      const activeProj = data.projectiles.some((p) => p.active);
      if (!activeProj && !anyWormMoving) {
        data.turnPhase = 'between_turns';
        for (const player of Object.values(data.players)) {
          player.alive = player.wormIds.some((wid) => data.worms[wid]?.alive);
        }
        if (this.checkWinCondition(data)) {
          data.gameOver = true;
        } else {
          this.advanceTurn(data);
        }
      }
    }

    if (!data.suddenDeath) {
      data.roundTimeRemaining -= 1 / 30;
      if (data.roundTimeRemaining <= 0) {
        this.triggerSuddenDeath(data);
      }
    } else if (cfg.suddenDeathType === 'water-rise' || cfg.suddenDeathType == null) {
      const riseAmount =
        cfg.waterRiseSpeed === 'fast' ? 0.15 : cfg.waterRiseSpeed === 'slow' ? 0.03 : 0.07;
      data.waterLevel -= riseAmount;
      for (const worm of Object.values(data.worms)) {
        if (worm.alive && worm.position.y >= data.waterLevel) {
          worm.alive = false;
          worm.hp = 0;
          this.emitEvent('worm_drowned', worm.playerId, { wormId: worm.id, wormName: worm.name });
        }
      }
    } else if (cfg.suddenDeathType === 'nuke') {
      if (Math.floor(data.turnCount * 30) % 60 === 0) {
        for (const worm of Object.values(data.worms)) {
          if (worm.alive) {
            worm.hp = Math.max(0, worm.hp - 1);
            if (worm.hp <= 0) {
              worm.alive = false;
              this.emitEvent('worm_poisoned', worm.playerId, { wormId: worm.id });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Projectile resolution
  // -------------------------------------------------------------------------

  private resolveProjectile(
    proj: Projectile,
    data: WormsState,
    newProjectiles: Projectile[],
  ): void {
    // Gravity
    const physics = this.getPhysics();
    proj.velocity.y += physics.gravity;

    // Wind
    const weapon = this.getWeaponDef(proj.weaponSlug);
    if (weapon?.windAffected && data.config.windEnabled !== false) {
      proj.velocity.x += data.wind * WIND_FACTOR;
    }

    // Update position
    proj.position.x += proj.velocity.x;
    proj.position.y += proj.velocity.y;

    // Trail
    proj.trail.push({ x: proj.position.x, y: proj.position.y });
    if (proj.trail.length > 40) proj.trail.shift();

    // Out of bounds check
    if (
      proj.position.x < -50 ||
      proj.position.x > data.terrainWidth + 50 ||
      proj.position.y > data.terrainHeight + 50
    ) {
      proj.active = false;
      return;
    }

    // Water check
    if (proj.position.y >= data.waterLevel) {
      proj.active = false;
      this.emitEvent('splash', undefined, { x: proj.position.x, y: data.waterLevel });
      return;
    }

    // Terrain collision
    const px = Math.floor(proj.position.x);
    const py = Math.floor(proj.position.y);
    if (px >= 0 && px < data.terrainWidth && py >= 0 && py < data.terrainHeight) {
      const groundY = data.terrain[px];
      if (groundY != null && py >= groundY) {
        if (weapon?.bounces && proj.fuse > 0) {
          // Bounce
          proj.velocity.y = -Math.abs(proj.velocity.y) * proj.bounciness;
          proj.velocity.x *= 0.8;
          proj.position.y = groundY - 1;
          if (Math.abs(proj.velocity.y) < 0.5 && Math.abs(proj.velocity.x) < 0.5) {
            // Settled, wait for fuse
            proj.velocity.x = 0;
            proj.velocity.y = 0;
          }
        } else if (proj.fuse <= 0 || proj.fuse === -1) {
          // Impact detonation
          this.detonate(proj, data, newProjectiles);
          return;
        }
      }
    }

    // Worm collision (for non-bouncing projectiles)
    if (!weapon?.bounces || proj.fuse === -1) {
      for (const worm of Object.values(data.worms)) {
        if (!worm.alive) continue;
        const dist = Math.hypot(
          worm.position.x - proj.position.x,
          worm.position.y - proj.position.y,
        );
        if (dist < 8) {
          this.detonate(proj, data, newProjectiles);
          return;
        }
      }
    }

    // Fuse countdown (in seconds, decrement per tick at 30fps)
    if (proj.fuse > 0) {
      proj.fuse -= 1 / 30;
      if (proj.fuse <= 0) {
        this.detonate(proj, data, newProjectiles);
      }
    }
  }

  private detonate(proj: Projectile, data: WormsState, newProjectiles: Projectile[]): void {
    const weapon = this.getWeaponDef(proj.weaponSlug);
    if (!weapon) {
      proj.active = false;
      return;
    }
    proj.active = false;

    const cx = proj.position.x;
    const cy = proj.position.y;
    const physics = this.getPhysics();

    // Create crater
    if (weapon.radius > 0) {
      this.createCrater(data, cx, cy, weapon.radius);
    }

    // Damage and knockback worms
    for (const worm of Object.values(data.worms)) {
      if (!worm.alive) continue;
      const dist = Math.hypot(worm.position.x - cx, worm.position.y - cy);
      const effectiveRadius = Math.max(weapon.radius, 10);
      if (dist < effectiveRadius) {
        const falloff = 1 - dist / effectiveRadius;
        const damage = Math.round(weapon.damage * falloff);
        worm.hp = Math.max(0, worm.hp - damage);

        // Knockback
        const angle = Math.atan2(worm.position.y - cy, worm.position.x - cx);
        const knockback = falloff * damage * physics.knockbackForce;
        worm.velocity.x += Math.cos(angle) * knockback;
        worm.velocity.y += Math.sin(angle) * knockback - 1; // slight upward bias

        if (worm.hp <= 0) {
          worm.alive = false;
          this.emitEvent('worm_died', worm.playerId, {
            wormId: worm.id,
            wormName: worm.name,
            killedBy: proj.ownerId,
          });
        } else {
          this.emitEvent('damage', worm.playerId, {
            wormId: worm.id,
            damage,
            wormName: worm.name,
          });
        }
      }
    }

    this.emitEvent('explosion', undefined, {
      x: cx,
      y: cy,
      radius: weapon.radius,
      weapon: proj.weaponSlug,
    });

    // Cluster sub-projectiles
    if (weapon.clusters > 0) {
      for (let i = 0; i < weapon.clusters; i++) {
        const spreadAngle = (Math.PI * 2 * i) / weapon.clusters + (Math.random() - 0.5) * 0.5;
        data.projIdCounter++;
        newProjectiles.push({
          id: `cluster_${proj.id}_${data.projIdCounter}`,
          weaponSlug: proj.weaponSlug === 'banana-bomb' ? 'banana-cluster' : 'grenade-cluster',
          position: { x: cx, y: cy },
          velocity: {
            x: Math.cos(spreadAngle) * 4,
            y: Math.sin(spreadAngle) * 4 - 3,
          },
          fuse: 1.5 + Math.random(),
          bounciness: 0.3,
          trail: [],
          active: true,
          ownerId: proj.ownerId,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Weapon firing methods
  // -------------------------------------------------------------------------

  private fireProjectile(
    worm: Worm,
    weapon: WeaponDef,
    slug: string,
    angle: number,
    power: number,
    data: WormsState,
  ): void {
    const speed = weapon.speed * (power / 100);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const fuse = weapon.bounces ? data.fuseTimer : weapon.fuse;

    data.projIdCounter++;
    data.projectiles.push({
      id: `proj_${data.projIdCounter}`,
      weaponSlug: slug,
      position: { x: worm.position.x, y: worm.position.y - 5 },
      velocity: { x: vx, y: vy },
      fuse,
      bounciness: weapon.bounciness,
      trail: [],
      active: true,
      ownerId: worm.id,
    });
  }

  private fireHitscan(
    worm: Worm,
    weapon: WeaponDef,
    slug: string,
    angle: number,
    data: WormsState,
  ): void {
    // Raycast from worm position
    for (let shot = 0; shot < weapon.shots; shot++) {
      let hx = worm.position.x;
      let hy = worm.position.y - 5;
      const dx = Math.cos(angle) * 2;
      const dy = Math.sin(angle) * 2;
      let hitWorm: Worm | null = null;

      for (let step = 0; step < 300; step++) {
        hx += dx;
        hy += dy;

        // Out of bounds
        if (hx < 0 || hx >= data.terrainWidth || hy < 0 || hy >= data.terrainHeight) break;

        // Terrain hit
        const groundY = data.terrain[Math.floor(hx)];
        if (groundY != null && hy >= groundY) {
          this.createCrater(data, hx, hy, 5);
          break;
        }

        // Worm hit
        for (const w of Object.values(data.worms)) {
          if (!w.alive || w.id === worm.id) continue;
          if (Math.hypot(w.position.x - hx, w.position.y - hy) < 10) {
            hitWorm = w;
            break;
          }
        }
        if (hitWorm) break;
      }

      if (hitWorm) {
        hitWorm.hp = Math.max(0, hitWorm.hp - weapon.damage);
        const knockAngle = Math.atan2(
          hitWorm.position.y - worm.position.y,
          hitWorm.position.x - worm.position.x,
        );
        hitWorm.velocity.x += Math.cos(knockAngle) * 5;
        hitWorm.velocity.y += Math.sin(knockAngle) * 5 - 2;

        if (hitWorm.hp <= 0) {
          hitWorm.alive = false;
          this.emitEvent('worm_died', hitWorm.playerId, {
            wormId: hitWorm.id,
            wormName: hitWorm.name,
            killedBy: worm.id,
          });
        } else {
          this.emitEvent('damage', hitWorm.playerId, {
            wormId: hitWorm.id,
            damage: weapon.damage,
          });
        }

        this.emitEvent('hitscan_hit', worm.playerId, {
          weapon: slug,
          hitX: hx,
          hitY: hy,
          targetWorm: hitWorm.id,
        });
      }
    }
  }

  private fireMelee(worm: Worm, weapon: WeaponDef, slug: string, data: WormsState): void {
    const dir = worm.facingRight ? 1 : -1;
    let bestTarget: Worm | null = null;
    let bestDist = Infinity;

    for (const w of Object.values(data.worms)) {
      if (!w.alive || w.id === worm.id) continue;
      const dist = Math.hypot(w.position.x - worm.position.x, w.position.y - worm.position.y);
      if (dist < MELEE_RANGE && dist < bestDist) {
        bestDist = dist;
        bestTarget = w;
      }
    }

    if (bestTarget) {
      bestTarget.hp = Math.max(0, bestTarget.hp - weapon.damage);

      let kb = MELEE_KNOCKBACK;
      if (slug === 'baseball-bat') kb = BAT_KNOCKBACK;
      else if (slug === 'prod') kb = PROD_KNOCKBACK;

      bestTarget.velocity.x = dir * kb;
      bestTarget.velocity.y = -kb * 0.5;

      if (bestTarget.hp <= 0) {
        bestTarget.alive = false;
        this.emitEvent('worm_died', bestTarget.playerId, {
          wormId: bestTarget.id,
          wormName: bestTarget.name,
          killedBy: worm.id,
        });
      }

      this.emitEvent('melee_hit', worm.playerId, {
        weapon: slug,
        targetWorm: bestTarget.id,
        damage: weapon.damage,
        knockback: kb,
      });
    } else {
      this.emitEvent('melee_miss', worm.playerId, { weapon: slug });
    }
  }

  private firePlaced(worm: Worm, weapon: WeaponDef, slug: string, data: WormsState): void {
    data.projIdCounter++;
    data.projectiles.push({
      id: `placed_${data.projIdCounter}`,
      weaponSlug: slug,
      position: { x: worm.position.x, y: worm.position.y },
      velocity: { x: 0, y: 0 },
      fuse: weapon.fuse,
      bounciness: 0,
      trail: [],
      active: true,
      ownerId: worm.id,
    });
  }

  private fireAirstrike(
    weapon: WeaponDef,
    slug: string,
    targetX: number,
    ownerId: string,
    data: WormsState,
  ): void {
    const spacing = 20;
    const startX = targetX - ((weapon.shots - 1) * spacing) / 2;

    for (let i = 0; i < weapon.shots; i++) {
      data.projIdCounter++;
      data.projectiles.push({
        id: `air_${data.projIdCounter}`,
        weaponSlug: slug,
        position: { x: startX + i * spacing, y: -20 - i * 10 },
        velocity: { x: 0, y: weapon.speed },
        fuse: -1,
        bounciness: 0,
        trail: [],
        active: true,
        ownerId,
      });
    }
  }

  private fireUtility(
    playerId: string,
    worm: Worm,
    _weapon: WeaponDef,
    slug: string,
    action: GameAction,
    data: WormsState,
  ): ActionResult {
    switch (slug) {
      case 'teleport': {
        const tx = Number(action.payload.targetX ?? worm.position.x);
        const ty = Number(action.payload.targetY ?? worm.position.y);
        if (tx < 0 || tx >= data.terrainWidth || ty < 0 || ty >= data.terrainHeight) {
          return { success: false, error: 'Teleport target out of bounds' };
        }
        worm.position.x = tx;
        worm.position.y = ty;
        data.hasFiredThisTurn = true;
        this.advanceTurn(data);
        this.emitEvent('teleport', playerId, { wormId: worm.id, x: tx, y: ty });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'ninja-rope': {
        // Simplified: teleport worm along rope direction
        const ropeAngle = data.aimAngle;
        const ropeDist = 80;
        const nx = worm.position.x + Math.cos(ropeAngle) * ropeDist;
        const ny = worm.position.y + Math.sin(ropeAngle) * ropeDist;
        const clampedX = Math.max(0, Math.min(data.terrainWidth - 1, nx));
        const groundY = this.findGroundLevel(data.terrain, data.terrainWidth, Math.floor(clampedX));
        worm.position.x = clampedX;
        worm.position.y = groundY - 1;
        // Ninja rope does NOT end turn
        if (data.players[playerId] && data.players[playerId].weapons['ninja-rope'] > 0) {
          data.players[playerId].weapons['ninja-rope']--;
        }
        this.emitEvent('ninja_rope', playerId, { wormId: worm.id });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'girder': {
        const gx = Number(
          action.payload.targetX ?? worm.position.x + (worm.facingRight ? 40 : -40),
        );
        const gy = Number(action.payload.targetY ?? worm.position.y - 20);
        // Place a horizontal girder: fill terrain in a 40px wide, 3px tall area
        for (let x = Math.floor(gx) - 20; x < Math.floor(gx) + 20; x++) {
          if (x >= 0 && x < data.terrainWidth) {
            const currentGround = data.terrain[x];
            if (Math.floor(gy) < currentGround) {
              data.terrain[x] = Math.floor(gy);
            }
          }
        }
        data.hasFiredThisTurn = true;
        this.advanceTurn(data);
        this.emitEvent('girder_placed', playerId, { x: gx, y: gy });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'blowtorch': {
        const dir = worm.facingRight ? 1 : -1;
        for (let i = 0; i < BLOWTORCH_LENGTH; i++) {
          const bx = Math.floor(worm.position.x + i * dir);
          if (bx >= 0 && bx < data.terrainWidth) {
            // Raise the ground at this column to create a horizontal tunnel
            const currentGround = data.terrain[bx];
            if (currentGround <= worm.position.y + 5) {
              data.terrain[bx] = Math.floor(worm.position.y + 6);
            }
          }
        }
        // Move worm through tunnel
        worm.position.x += dir * BLOWTORCH_LENGTH * 0.8;
        worm.position.x = Math.max(0, Math.min(data.terrainWidth - 1, worm.position.x));
        // Check for worms hit
        for (const w of Object.values(data.worms)) {
          if (!w.alive || w.id === worm.id) continue;
          if (
            Math.abs(w.position.x - worm.position.x) < BLOWTORCH_LENGTH &&
            Math.abs(w.position.y - worm.position.y) < 10
          ) {
            w.hp = Math.max(0, w.hp - 15);
            if (w.hp <= 0) {
              w.alive = false;
              this.emitEvent('worm_died', w.playerId, { wormId: w.id, killedBy: worm.id });
            }
          }
        }
        data.hasFiredThisTurn = true;
        data.turnPhase = 'retreat';
        data.retreatStartedAt = Date.now();
        this.emitEvent('blowtorch', playerId, { wormId: worm.id });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'drill': {
        for (let i = 0; i < DRILL_DEPTH; i++) {
          const dy = Math.floor(worm.position.y + i);
          const dx = Math.floor(worm.position.x);
          if (dx >= 0 && dx < data.terrainWidth && dy < data.terrainHeight) {
            // Lower the ground below the worm
            if (data.terrain[dx] <= dy) {
              data.terrain[dx] = dy + 1;
            }
          }
          // Also clear a 3-wide column for the drill
          for (let w = -1; w <= 1; w++) {
            const ddx = dx + w;
            if (ddx >= 0 && ddx < data.terrainWidth && data.terrain[ddx] <= dy) {
              data.terrain[ddx] = dy + 1;
            }
          }
        }
        worm.position.y += DRILL_DEPTH * 0.8;
        // Check for worms hit below
        for (const w of Object.values(data.worms)) {
          if (!w.alive || w.id === worm.id) continue;
          if (
            Math.abs(w.position.x - worm.position.x) < 5 &&
            w.position.y > worm.position.y - DRILL_DEPTH &&
            w.position.y < worm.position.y
          ) {
            w.hp = Math.max(0, w.hp - 15);
            if (w.hp <= 0) {
              w.alive = false;
              this.emitEvent('worm_died', w.playerId, { wormId: w.id, killedBy: worm.id });
            }
          }
        }
        data.hasFiredThisTurn = true;
        data.turnPhase = 'retreat';
        data.retreatStartedAt = Date.now();
        this.emitEvent('drill', playerId, { wormId: worm.id });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'skip': {
        data.hasFiredThisTurn = true;
        this.advanceTurn(data);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      default:
        return { success: false, error: `Unknown utility: ${slug}` };
    }
  }

  // -------------------------------------------------------------------------
  // Worm physics
  // -------------------------------------------------------------------------

  private resolveWormPhysics(worm: Worm, data: WormsState): void {
    const startY = worm.position.y;
    const physics = this.getPhysics();

    // Apply gravity
    worm.velocity.y += physics.gravity;

    // Update position
    worm.position.x += worm.velocity.x;
    worm.position.y += worm.velocity.y;

    // Friction
    worm.velocity.x *= 0.95;

    // Clamp X
    worm.position.x = Math.max(0, Math.min(data.terrainWidth - 1, worm.position.x));

    // Ground collision
    const groundY = this.findGroundLevel(
      data.terrain,
      data.terrainWidth,
      Math.floor(worm.position.x),
    );
    if (worm.position.y >= groundY - 1) {
      const fallDistance = worm.position.y - startY;

      // Fall damage
      if (data.config.fallDamage !== false && worm.velocity.y > 3) {
        const dmg = Math.floor(
          Math.max(0, fallDistance - physics.safeHeight) * physics.fallDamageMultiplier,
        );
        if (dmg > 0) {
          worm.hp = Math.max(0, worm.hp - dmg);
          this.emitEvent('fall_damage', worm.playerId, {
            wormId: worm.id,
            damage: dmg,
          });
          if (worm.hp <= 0) {
            worm.alive = false;
            this.emitEvent('worm_died', worm.playerId, {
              wormId: worm.id,
              wormName: worm.name,
              cause: 'fall',
            });
          }
        }
      }

      worm.position.y = groundY - 1;
      worm.velocity.x = 0;
      worm.velocity.y = 0;
    }

    // Water check
    if (worm.position.y >= data.waterLevel) {
      worm.alive = false;
      worm.hp = 0;
      worm.velocity.x = 0;
      worm.velocity.y = 0;
      this.emitEvent('worm_drowned', worm.playerId, {
        wormId: worm.id,
        wormName: worm.name,
      });
    }

    // Small velocity: snap to zero
    if (Math.abs(worm.velocity.x) < 0.1) worm.velocity.x = 0;
    if (Math.abs(worm.velocity.y) < 0.1 && worm.position.y >= groundY - 2) worm.velocity.y = 0;
  }

  // -------------------------------------------------------------------------
  // Terrain
  // -------------------------------------------------------------------------

  private generateTerrain(width: number, height: number, seed: number): number[] {
    const rng = seededRandom(seed);
    const terrain: number[] = new Array(width);
    const baseHeight = height * 0.55;

    for (let x = 0; x < width; x++) {
      let h = baseHeight;
      // Three octaves of sine waves for rolling hills
      h += Math.sin(x / 80 + rng() * 0.1) * 60;
      h += Math.sin(x / 30 + rng() * 0.05) * 25;
      h += Math.sin(x / 12 + rng() * 0.02) * 10;

      // Flat plateaus for spawn points
      const section = Math.floor(x / (width / 4));
      const sectionCenter = (section + 0.5) * (width / 4);
      const distFromCenter = Math.abs(x - sectionCenter);
      if (distFromCenter < 30) {
        // Flatten near spawn centers
        const flatFactor = 1 - distFromCenter / 30;
        h = h * (1 - flatFactor * 0.3) + baseHeight * flatFactor * 0.3;
      }

      // Clamp
      terrain[x] = Math.floor(Math.max(height * 0.2, Math.min(height * 0.85, h)));
    }

    // Smooth pass
    for (let pass = 0; pass < 3; pass++) {
      for (let x = 1; x < width - 1; x++) {
        terrain[x] = Math.floor((terrain[x - 1] + terrain[x] * 2 + terrain[x + 1]) / 4);
      }
    }

    return terrain;
  }

  private findGroundLevel(terrain: number[], width: number, x: number): number {
    const cx = Math.max(0, Math.min(width - 1, x));
    return terrain[cx] ?? 0;
  }

  private createCrater(data: WormsState, cx: number, cy: number, radius: number): void {
    for (let x = Math.floor(cx - radius); x <= Math.floor(cx + radius); x++) {
      if (x < 0 || x >= data.terrainWidth) continue;
      const dx = x - cx;
      const halfChord = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      const craterBottom = cy + halfChord;
      if (craterBottom > data.terrain[x]) {
        data.terrain[x] = Math.floor(Math.min(data.terrainHeight, craterBottom));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Turn management
  // -------------------------------------------------------------------------

  private advanceTurn(data: WormsState): void {
    // Update alive status
    for (const player of Object.values(data.players)) {
      player.alive = player.wormIds.some((wid) => data.worms[wid]?.alive);
    }

    // Filter dead players from turn order
    data.turnOrder = data.turnOrder.filter((pid) => data.players[pid]?.alive);

    if (this.checkWinCondition(data)) {
      data.gameOver = true;
      return;
    }

    // Advance index
    data.currentTurnIndex = (data.currentTurnIndex + 1) % data.turnOrder.length;
    data.turnCount++;

    // Select next worm for the player (round-robin)
    const nextPlayerId = data.turnOrder[data.currentTurnIndex];
    const nextPlayer = data.players[nextPlayerId];
    if (!nextPlayer) {
      data.gameOver = true;
      return;
    }

    const aliveWorms = nextPlayer.wormIds.filter((wid) => data.worms[wid]?.alive);
    if (aliveWorms.length === 0) {
      nextPlayer.alive = false;
      this.advanceTurn(data);
      return;
    }

    nextPlayer.wormCycleIndex = (nextPlayer.wormCycleIndex + 1) % aliveWorms.length;
    data.activeWormId = aliveWorms[nextPlayer.wormCycleIndex];

    // Reset turn state
    data.turnPhase = 'moving';
    data.turnStartedAt = Date.now();
    data.hasFiredThisTurn = false;
    data.retreatStartedAt = 0;
    data.shotsFiredThisTurn = 0;
    data.selectedWeapon = 'bazooka';
    data.aimAngle = 0;
    data.power = 50;

    // Randomize wind
    if (data.config.windEnabled !== false) {
      data.wind = Math.round((Math.random() - 0.5) * 200);
    }

    // Maybe drop a crate
    const crateChance = (data.config.crateFrequency ?? 5) / 10;
    if (Math.random() < crateChance) {
      this.spawnCrate(data);
    }

    // Decrement round time per turn
    data.roundTimeRemaining -= data.config.turnTimeSeconds ?? 45;

    this.emitEvent('turn_start', nextPlayerId, {
      activeWorm: data.activeWormId,
      wind: data.wind,
      turnNumber: data.turnCount,
    });

    // Auto-play NPC turn
    if (nextPlayer.isNPC) {
      this.executeNPCTurn(data);
    }
  }

  private isPlayerTurn(playerId: string, data: WormsState): boolean {
    return data.turnOrder[data.currentTurnIndex] === playerId;
  }

  // -------------------------------------------------------------------------
  // NPC AI
  // -------------------------------------------------------------------------

  private handleNPCTurn(data: WormsState): ActionResult {
    const currentPlayerId = data.turnOrder[data.currentTurnIndex];
    const player = data.players[currentPlayerId];
    if (!player?.isNPC) {
      return { success: false, error: 'Not an NPC turn' };
    }
    this.executeNPCTurn(data);
    // Auto-resolve physics so one npc_turn action completes the full turn
    // (projectile flight, detonation, worm settling). Chains through
    // consecutive NPC turns via advanceTurn until a human turn or game over.
    let ticks = 0;
    while (data.turnPhase === 'resolving' && ticks < 600 && !data.gameOver) {
      this.resolveTick(data);
      ticks++;
    }
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private executeNPCTurn(data: WormsState): void {
    const currentPlayerId = data.turnOrder[data.currentTurnIndex];
    const player = data.players[currentPlayerId];
    if (!player) return;

    const worm = data.activeWormId ? data.worms[data.activeWormId] : null;
    if (!worm || !worm.alive) {
      this.advanceTurn(data);
      return;
    }

    // Find enemies
    const enemies = Object.values(data.worms).filter(
      (w) => w.alive && w.playerId !== currentPlayerId,
    );
    if (enemies.length === 0) return;

    // Pick target (nearest)
    enemies.sort((a, b) => {
      const da = Math.hypot(a.position.x - worm.position.x, a.position.y - worm.position.y);
      const db = Math.hypot(b.position.x - worm.position.x, b.position.y - worm.position.y);
      return da - db;
    });
    const target = enemies[0];
    const dist = Math.hypot(
      target.position.x - worm.position.x,
      target.position.y - worm.position.y,
    );

    // Pick weapon
    let weaponSlug = 'bazooka';
    if (dist < 30 && player.weapons['fire-punch'] !== 0) weaponSlug = 'fire-punch';
    else if (dist < 40 && player.weapons['baseball-bat'] !== 0) weaponSlug = 'baseball-bat';
    else if (dist < 100 && player.weapons.shotgun !== 0) weaponSlug = 'shotgun';
    else if (dist < 200 && player.weapons.grenade !== 0) weaponSlug = 'grenade';
    else if (player.weapons.bazooka !== 0) weaponSlug = 'bazooka';

    const weapon = this.getWeaponDef(weaponSlug);
    if (!weapon) return;

    // Aim toward target with inaccuracy
    const dx = target.position.x - worm.position.x;
    const dy = target.position.y - worm.position.y;
    let angle = Math.atan2(dy, dx);
    angle += (Math.random() - 0.5) * 0.35; // +/- ~10 degrees

    const power = Math.min(100, Math.max(30, dist * 0.4 + Math.random() * 20));

    worm.facingRight = dx > 0;

    // Consume ammo
    if (player.weapons[weaponSlug] > 0) {
      player.weapons[weaponSlug]--;
    }

    // Fire
    if (weapon.type === 'melee') {
      this.fireMelee(worm, weapon, weaponSlug, data);
    } else if (weapon.type === 'hitscan') {
      this.fireHitscan(worm, weapon, weaponSlug, angle, data);
    } else {
      this.fireProjectile(worm, weapon, weaponSlug, angle, power, data);
    }

    data.hasFiredThisTurn = true;
    data.turnPhase = 'resolving';

    this.emitEvent('weapon_fire', currentPlayerId, {
      weapon: weaponSlug,
      angle,
      power,
      wormId: worm.id,
      npc: true,
    });
  }

  // -------------------------------------------------------------------------
  // Crates
  // -------------------------------------------------------------------------

  private spawnCrate(data: WormsState): void {
    const x = Math.floor(Math.random() * (data.terrainWidth - 100)) + 50;
    const types: Array<'weapon' | 'health' | 'utility'> = ['weapon', 'weapon', 'health', 'utility'];
    const type = types[Math.floor(Math.random() * types.length)];

    let content = '';
    if (type === 'health') {
      content = 'medkit';
    } else if (type === 'weapon') {
      const rareWeapons = [
        'banana-bomb',
        'holy-hand-grenade',
        'airstrike',
        'napalm-strike',
        'cluster-bomb',
        'dynamite',
        'homing-missile',
      ];
      content = rareWeapons[Math.floor(Math.random() * rareWeapons.length)];
    } else {
      const utilItems = ['teleport', 'ninja-rope', 'girder'];
      content = utilItems[Math.floor(Math.random() * utilItems.length)];
    }

    data.crateIdCounter++;
    data.crates.push({
      id: `crate_${data.crateIdCounter}`,
      position: { x, y: 0 },
      type,
      content,
      falling: true,
      parachuteY: 0,
    });

    this.emitEvent('crate_drop', undefined, { crateId: `crate_${data.crateIdCounter}`, type });
  }

  private checkCrateCollection(worm: Worm, data: WormsState): void {
    for (const crate of data.crates) {
      if (crate.falling) continue;
      const dist = Math.hypot(
        worm.position.x - crate.position.x,
        worm.position.y - crate.position.y,
      );
      if (dist < 15) {
        const player = data.players[worm.playerId];
        if (!player) continue;

        if (crate.type === 'health') {
          worm.hp = Math.min(worm.maxHp, worm.hp + (data.config.healthCrateAmount ?? 25));
          this.emitEvent('crate_collected', worm.playerId, {
            type: 'health',
            amount: data.config.healthCrateAmount ?? 25,
            wormId: worm.id,
          });
        } else {
          // Add weapon/utility ammo
          const current = player.weapons[crate.content] ?? 0;
          player.weapons[crate.content] = current === -1 ? -1 : current + 1;
          this.emitEvent('crate_collected', worm.playerId, {
            type: crate.type,
            content: crate.content,
            wormId: worm.id,
          });
        }

        // Remove crate
        crate.position.y = -100;
      }
    }
    data.crates = data.crates.filter((c) => c.position.y >= 0);
  }

  // -------------------------------------------------------------------------
  // Sudden death
  // -------------------------------------------------------------------------

  private triggerSuddenDeath(data: WormsState): void {
    data.suddenDeath = true;
    const type = data.config.suddenDeathType ?? 'water-rise';

    if (type === 'one-hp') {
      for (const worm of Object.values(data.worms)) {
        if (worm.alive) {
          worm.hp = 1;
        }
      }
    }

    this.emitEvent('sudden_death', undefined, { type });
  }

  // -------------------------------------------------------------------------
  // Win condition
  // -------------------------------------------------------------------------

  private checkWinCondition(data: WormsState): boolean {
    const aliveTeams = new Set<number>();
    for (const worm of Object.values(data.worms)) {
      if (worm.alive) aliveTeams.add(worm.teamId);
    }
    return aliveTeams.size <= 1;
  }

  // -------------------------------------------------------------------------
  // BaseGame overrides
  // -------------------------------------------------------------------------

  protected checkGameOver(): boolean {
    const data = this.getData<WormsState>();
    return data.gameOver || this.checkWinCondition(data);
  }

  protected determineWinner(): string | null {
    const data = this.getData<WormsState>();
    for (const player of Object.values(data.players)) {
      if (player.alive) return player.id;
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<WormsState>();
    const scores: Record<string, number> = {};
    for (const player of Object.values(data.players)) {
      const aliveCount = player.wormIds.filter((wid) => data.worms[wid]?.alive).length;
      const totalHp = player.wormIds.reduce((sum, wid) => sum + (data.worms[wid]?.hp ?? 0), 0);
      scores[player.id] = aliveCount * 100 + totalHp;
    }
    return scores;
  }
}
