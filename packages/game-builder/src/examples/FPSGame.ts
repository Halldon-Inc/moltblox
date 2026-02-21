/**
 * FPSGame - DOOM-style first-person shooter template
 *
 * Navigate maze-like levels, defeat enemies, find secrets, and reach the exit!
 * Demonstrates:
 * - 2D grid-based level design (raycasting-ready)
 * - Multi-level progression with persistent player state
 * - Thin template pattern: renderer owns real-time logic, template owns session state
 * - Configurable difficulty and secret level access via item purchases
 *
 * WHY this is a thin template:
 * The FPS renderer (FPSRenderer.tsx) owns all real-time game logic including
 * raycasting, physics, enemy AI, and input handling. This template provides
 * the initial level data (maps, enemy spawns, pickup positions) and handles
 * session-level state tracking (score, kills, level progression). The renderer
 * reports high-level actions ('level_complete', 'game_over', 'score_update')
 * back to this template so the server can persist progress and calculate scores.
 *
 * WHY 2D grids for level design:
 * Classic DOOM-style raycasters use 2D grids where each cell is either empty
 * or a wall of a specific type. The renderer casts rays from the player's
 * position through the grid to determine visible walls and their heights.
 * Different wall values (1-5) map to different textures/colors. Zero means
 * empty space the player can walk through.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// =====================
// EXPORTED TYPES
// =====================

export interface FPSConfig {
  difficulty?: 'easy' | 'normal' | 'hard';
  startLevel?: number;
  secretLevelUnlocked?: boolean;
  secondaryMechanic?: 'rhythm' | 'puzzle' | 'timing' | 'resource';
  theme?: {
    wallColors?: Record<number, string>;
    floorColor?: string;
    ceilingColor?: string;
  };
  gameplay?: {
    moveSpeed?: number;
    turnSpeed?: number;
    damageMultiplier?: number;
  };
  content?: {
    weapons?: WeaponDef[];
    enemies?: Record<string, EnemyStatsDef>;
    levels?: LevelData[];
  };
}

export interface LevelData {
  name: string;
  map: number[][];
  playerStart: { x: number; y: number; angle: number };
  enemies: { x: number; y: number; type: 'grunt' | 'soldier' | 'heavy' | 'boss' }[];
  pickups: {
    x: number;
    y: number;
    type:
      | 'health'
      | 'armor'
      | 'ammo'
      | 'weapon_shotgun'
      | 'weapon_chaingun'
      | 'weapon_rocket'
      | 'weapon_bfg';
    value: number;
  }[];
  secrets: { x: number; y: number }[];
  exitPosition: { x: number; y: number };
}

export interface WeaponDef {
  name: string;
  damage: number;
  fireRate: number;
  ammoType: string | null;
  ammoPerShot: number;
}

export interface EnemyStatsDef {
  health: number;
  damage: number;
  speed: number;
  attackRange: number;
  color: string;
}

interface FPSGameData {
  [key: string]: unknown;
  level: number;
  levelData: LevelData;
  score: number;
  kills: number;
  totalEnemies: number;
  secretsFound: number;
  totalSecrets: number;
  levelsCompleted: number;
  totalLevels: number;
  playerHealth: number;
  playerArmor: number;
  playerWeapons: string[];
  difficulty: 'easy' | 'normal' | 'hard';
  gameOver: boolean;
  secretLevelUnlocked: boolean;
}

// =====================
// WEAPONS
// =====================

export const WEAPONS: WeaponDef[] = [
  { name: 'Fist', damage: 10, fireRate: 500, ammoType: null, ammoPerShot: 0 },
  { name: 'Pistol', damage: 15, fireRate: 400, ammoType: 'bullets', ammoPerShot: 1 },
  { name: 'Shotgun', damage: 50, fireRate: 800, ammoType: 'shells', ammoPerShot: 1 },
  { name: 'Chaingun', damage: 20, fireRate: 100, ammoType: 'bullets', ammoPerShot: 1 },
  { name: 'Rocket Launcher', damage: 100, fireRate: 1000, ammoType: 'rockets', ammoPerShot: 1 },
  { name: 'BFG', damage: 200, fireRate: 2000, ammoType: 'cells', ammoPerShot: 5 },
];

// =====================
// ENEMY STATS
// =====================

export const ENEMY_STATS: Record<string, EnemyStatsDef> = {
  grunt: { health: 30, damage: 5, speed: 1.5, attackRange: 5, color: '#884422' },
  soldier: { health: 60, damage: 10, speed: 2, attackRange: 8, color: '#446688' },
  heavy: { health: 120, damage: 20, speed: 1, attackRange: 6, color: '#664444' },
  boss: { health: 500, damage: 30, speed: 1.5, attackRange: 10, color: '#880000' },
};

// =====================
// LEVEL DATA
// =====================

/**
 * Level 1: Training Facility
 * Simple layout with corridors and a few rooms. Good for learning movement and combat.
 * 4 grunts, 1 soldier. Health and ammo pickups near encounters.
 */
const LEVEL_1: LevelData = {
  name: 'Training Facility',
  map: [
    // 16x16 grid: 0=empty, 1=gray wall, 2=red wall, 3=blue wall, 4=green wall, 5=door
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 5, 0, 0, 0, 1, 1, 5, 1, 1, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 1, 5, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 5, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 5, 1, 1, 0, 1],
    [1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 5, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  playerStart: { x: 1.5, y: 1.5, angle: 0 },
  enemies: [
    { x: 5.5, y: 2.5, type: 'grunt' },
    { x: 10.5, y: 4.5, type: 'grunt' },
    { x: 2.5, y: 8.5, type: 'grunt' },
    { x: 11.5, y: 12.5, type: 'grunt' },
    { x: 4.5, y: 13.5, type: 'soldier' },
  ],
  pickups: [
    { x: 3.5, y: 1.5, type: 'ammo', value: 20 },
    { x: 7.5, y: 5.5, type: 'health', value: 25 },
    { x: 13.5, y: 1.5, type: 'armor', value: 50 },
    { x: 1.5, y: 6.5, type: 'weapon_shotgun', value: 1 },
    { x: 10.5, y: 11.5, type: 'ammo', value: 10 },
    { x: 14.5, y: 8.5, type: 'health', value: 25 },
  ],
  secrets: [{ x: 4.5, y: 10.5 }],
  exitPosition: { x: 14.5, y: 14.5 },
};

/**
 * Level 2: Demon Base
 * Complex layout with multiple rooms, corridors, and a secret area behind a
 * hidden wall. 8 enemies of mixed types guard key chokepoints.
 */
const LEVEL_2: LevelData = {
  name: 'Demon Base',
  map: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 2, 0, 0, 2, 2, 0, 2, 0, 0, 0, 0, 2],
    [2, 2, 5, 2, 2, 0, 0, 2, 2, 0, 2, 2, 5, 2, 2, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 2, 2, 2, 5, 2, 2, 5, 2, 2, 2, 0, 0, 2],
    [2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2],
    [2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2],
    [2, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0, 2],
    [2, 0, 0, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  playerStart: { x: 1.5, y: 1.5, angle: 1.57 },
  enemies: [
    { x: 8.5, y: 1.5, type: 'grunt' },
    { x: 13.5, y: 2.5, type: 'grunt' },
    { x: 1.5, y: 5.5, type: 'soldier' },
    { x: 14.5, y: 5.5, type: 'soldier' },
    { x: 5.5, y: 8.5, type: 'grunt' },
    { x: 10.5, y: 9.5, type: 'soldier' },
    { x: 7.5, y: 13.5, type: 'heavy' },
    { x: 1.5, y: 13.5, type: 'grunt' },
    { x: 7.5, y: 10.5, type: 'soldier' },
    { x: 14.5, y: 13.5, type: 'grunt' },
  ],
  pickups: [
    { x: 3.5, y: 2.5, type: 'ammo', value: 20 },
    { x: 7.5, y: 5.5, type: 'health', value: 50 },
    { x: 14.5, y: 1.5, type: 'armor', value: 50 },
    { x: 1.5, y: 12.5, type: 'weapon_chaingun', value: 1 },
    { x: 8.5, y: 8.5, type: 'ammo', value: 30 },
    { x: 11.5, y: 1.5, type: 'health', value: 25 },
    { x: 7.5, y: 10.5, type: 'weapon_rocket', value: 1 },
    { x: 14.5, y: 12.5, type: 'ammo', value: 20 },
  ],
  // Secret area behind the blue wall (type 3) at row 10-11, col 7
  secrets: [{ x: 7.5, y: 10.5 }],
  exitPosition: { x: 14.5, y: 14.5 },
};

/**
 * Level 3: Boss Arena
 * Open central arena with pillars for cover. The boss spawns in the center
 * with minion soldiers on the perimeter. Weapon and health pickups are
 * placed around the edges to reward movement during the fight.
 */
const LEVEL_3: LevelData = {
  name: 'Boss Arena',
  map: [
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  ],
  playerStart: { x: 1.5, y: 14.5, angle: -1.57 },
  enemies: [
    // Boss in the center
    { x: 7.5, y: 7.5, type: 'boss' },
    // Minions around the perimeter
    { x: 3.5, y: 1.5, type: 'soldier' },
    { x: 12.5, y: 1.5, type: 'soldier' },
    { x: 1.5, y: 7.5, type: 'soldier' },
    { x: 14.5, y: 7.5, type: 'soldier' },
    { x: 7.5, y: 12.5, type: 'heavy' },
  ],
  pickups: [
    { x: 1.5, y: 1.5, type: 'weapon_rocket', value: 1 },
    { x: 14.5, y: 1.5, type: 'weapon_bfg', value: 1 },
    { x: 7.5, y: 1.5, type: 'health', value: 100 },
    { x: 1.5, y: 8.5, type: 'ammo', value: 50 },
    { x: 14.5, y: 8.5, type: 'ammo', value: 50 },
    { x: 7.5, y: 14.5, type: 'armor', value: 100 },
    { x: 5.5, y: 5.5, type: 'health', value: 50 },
    { x: 10.5, y: 10.5, type: 'health', value: 50 },
  ],
  secrets: [{ x: 14.5, y: 14.5 }],
  exitPosition: { x: 7.5, y: 3.5 },
};

/**
 * Level 4: Secret Level (The Vault)
 * Accessible only via item purchase (secretLevelUnlocked config). Unique
 * winding layout with high-value pickups and a mix of tough enemies.
 * Rewards skilled players with bonus score and rare weapons.
 */
const LEVEL_4: LevelData = {
  name: 'The Vault',
  map: [
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    [3, 0, 0, 3, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3],
    [3, 0, 0, 3, 0, 3, 3, 5, 3, 0, 3, 0, 3, 3, 0, 3],
    [3, 0, 0, 3, 0, 3, 0, 0, 3, 0, 5, 0, 3, 0, 0, 3],
    [3, 0, 0, 5, 0, 3, 0, 0, 3, 0, 3, 0, 3, 0, 0, 3],
    [3, 0, 0, 3, 0, 3, 0, 0, 5, 0, 3, 0, 5, 0, 0, 3],
    [3, 3, 0, 3, 0, 3, 3, 3, 3, 0, 3, 3, 3, 0, 3, 3],
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [3, 0, 3, 3, 3, 3, 0, 3, 3, 0, 3, 3, 3, 3, 0, 3],
    [3, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 0, 3],
    [3, 0, 3, 0, 0, 5, 0, 0, 3, 0, 0, 5, 0, 0, 0, 3],
    [3, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 0, 3],
    [3, 0, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 5, 3, 3],
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  ],
  playerStart: { x: 1.5, y: 1.5, angle: 0 },
  enemies: [
    { x: 7.5, y: 2.5, type: 'heavy' },
    { x: 13.5, y: 1.5, type: 'soldier' },
    { x: 1.5, y: 7.5, type: 'soldier' },
    { x: 14.5, y: 7.5, type: 'heavy' },
    { x: 4.5, y: 9.5, type: 'soldier' },
    { x: 8.5, y: 10.5, type: 'soldier' },
    { x: 13.5, y: 13.5, type: 'heavy' },
    { x: 7.5, y: 13.5, type: 'soldier' },
  ],
  pickups: [
    { x: 1.5, y: 2.5, type: 'weapon_bfg', value: 1 },
    { x: 6.5, y: 3.5, type: 'ammo', value: 50 },
    { x: 14.5, y: 4.5, type: 'health', value: 100 },
    { x: 7.5, y: 7.5, type: 'armor', value: 100 },
    { x: 3.5, y: 10.5, type: 'weapon_rocket', value: 1 },
    { x: 14.5, y: 9.5, type: 'ammo', value: 50 },
    { x: 1.5, y: 13.5, type: 'health', value: 100 },
    { x: 10.5, y: 13.5, type: 'weapon_chaingun', value: 1 },
  ],
  secrets: [
    { x: 13.5, y: 4.5 },
    { x: 3.5, y: 10.5 },
  ],
  exitPosition: { x: 14.5, y: 14.5 },
};

/**
 * All levels exported so the renderer can access map data directly.
 * Index 0-2 are the main campaign; index 3 is the secret level.
 */
export const LEVELS: LevelData[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

// =====================
// DIFFICULTY MODIFIERS
// =====================

const DIFFICULTY_MODIFIERS: Record<
  string,
  { enemyHealthMul: number; enemyDamageMul: number; playerDamageMul: number }
> = {
  easy: { enemyHealthMul: 0.5, enemyDamageMul: 0.5, playerDamageMul: 1.5 },
  normal: { enemyHealthMul: 1.0, enemyDamageMul: 1.0, playerDamageMul: 1.0 },
  hard: { enemyHealthMul: 1.5, enemyDamageMul: 1.5, playerDamageMul: 0.75 },
};

export { DIFFICULTY_MODIFIERS };

// =====================
// GAME CLASS
// =====================

export class FPSGame extends BaseGame {
  readonly name = 'DOOM Runner';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private getLevels(): LevelData[] {
    const cfg = this.config as FPSConfig;
    return (cfg.content?.levels as LevelData[]) ?? LEVELS;
  }

  protected initializeState(playerIds: string[]): FPSGameData {
    const cfg = this.config as FPSConfig;
    const difficulty = cfg.difficulty ?? 'normal';
    const startLevel = cfg.startLevel ?? 1;
    const secretLevelUnlocked = cfg.secretLevelUnlocked ?? false;
    const levels = this.getLevels();

    // Clamp start level to valid range
    const maxLevel = secretLevelUnlocked ? levels.length : levels.length - 1;
    const levelIndex = Math.max(0, Math.min(startLevel - 1, maxLevel - 1));
    const levelData = levels[levelIndex];

    this.emitEvent('game_started', playerIds[0], {
      level: levelIndex + 1,
      levelName: levelData.name,
      difficulty,
    });

    return {
      level: levelIndex + 1,
      levelData,
      score: 0,
      kills: 0,
      totalEnemies: levelData.enemies.length,
      secretsFound: 0,
      totalSecrets: levelData.secrets.length,
      levelsCompleted: 0,
      totalLevels: secretLevelUnlocked ? levels.length : levels.length - 1,
      playerHealth: 100,
      playerArmor: 0,
      playerWeapons: ['Fist', 'Pistol'],
      difficulty,
      gameOver: false,
      secretLevelUnlocked,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FPSGameData>();

    if (data.gameOver) {
      return { success: false, error: 'Game is over' };
    }

    switch (action.type) {
      /**
       * Load a specific level. The renderer calls this when transitioning
       * between levels or when the player restarts.
       */
      case 'start_level': {
        const levels = this.getLevels();
        const requestedLevel = Number(action.payload.level) || 1;
        const maxLevel = data.secretLevelUnlocked ? levels.length : levels.length - 1;

        if (requestedLevel < 1 || requestedLevel > maxLevel) {
          return {
            success: false,
            error: `Invalid level: ${requestedLevel}. Range is 1 to ${maxLevel}`,
          };
        }

        // Secret level check
        if (requestedLevel === levels.length && !data.secretLevelUnlocked) {
          return { success: false, error: 'Secret level is locked. Purchase access to unlock it.' };
        }

        const levelData = levels[requestedLevel - 1];
        data.level = requestedLevel;
        data.levelData = levelData;
        data.totalEnemies = levelData.enemies.length;
        data.totalSecrets = levelData.secrets.length;

        this.emitEvent('level_started', playerId, {
          level: requestedLevel,
          levelName: levelData.name,
          enemies: levelData.enemies.length,
          secrets: levelData.secrets.length,
        });

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * The renderer periodically reports score, kills, and secrets
       * so the server state stays in sync with the client.
       */
      case 'score_update': {
        const score = Number(action.payload.score) || 0;
        const kills = Number(action.payload.kills) || 0;
        const secretsFound = Number(action.payload.secretsFound) || 0;

        data.score = score;
        data.kills = kills;
        data.secretsFound = secretsFound;

        // Persist player stats from renderer
        if (action.payload.playerHealth != null) {
          data.playerHealth = Number(action.payload.playerHealth);
        }
        if (action.payload.playerArmor != null) {
          data.playerArmor = Number(action.payload.playerArmor);
        }
        if (Array.isArray(action.payload.playerWeapons)) {
          data.playerWeapons = action.payload.playerWeapons as string[];
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Player reached the level exit. Award bonuses, advance to the next level
       * or end the game if all levels are complete.
       */
      case 'level_complete': {
        const score = Number(action.payload.score) || 0;
        const kills = Number(action.payload.kills) || 0;
        const secretsFound = Number(action.payload.secretsFound) || 0;
        const time = Number(action.payload.time) || 0;

        data.score = score;
        data.kills = kills;
        data.secretsFound = secretsFound;
        data.levelsCompleted++;

        // Time bonus: faster completion yields more points (cap at 10000)
        const timeBonus = Math.max(0, 10000 - Math.floor(time / 100));
        // Kill bonus: reward clearing all enemies
        const killRatio = data.totalEnemies > 0 ? kills / data.totalEnemies : 0;
        const killBonus = Math.floor(killRatio * 5000);
        // Secret bonus
        const secretBonus = secretsFound * 2000;

        data.score += timeBonus + killBonus + secretBonus;

        this.emitEvent('level_complete', playerId, {
          level: data.level,
          timeBonus,
          killBonus,
          secretBonus,
          totalScore: data.score,
          kills,
          secretsFound,
        });

        // Check if there is a next main level
        const levels = this.getLevels();
        const mainLevels = levels.length - 1; // Exclude secret level from main progression
        if (data.level < mainLevels) {
          // Auto-advance to next level
          const nextLevel = data.level + 1;
          const nextLevelData = levels[nextLevel - 1];
          data.level = nextLevel;
          data.levelData = nextLevelData;
          data.totalEnemies = nextLevelData.enemies.length;
          data.totalSecrets = nextLevelData.secrets.length;

          this.emitEvent('level_started', playerId, {
            level: nextLevel,
            levelName: nextLevelData.name,
          });
        }
        // If on the secret level or finished last main level, game continues
        // until checkGameOver evaluates

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Player died. Record final score and mark game as over.
       */
      case 'game_over': {
        const score = Number(action.payload.score) || data.score;
        const kills = Number(action.payload.kills) || data.kills;

        data.score = score;
        data.kills = kills;
        data.gameOver = true;
        data.playerHealth = 0;

        this.emitEvent('player_died', playerId, {
          level: data.level,
          finalScore: data.score,
          kills: data.kills,
        });

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Reset the game to level 1 with fresh state.
       */
      case 'restart': {
        const cfg = this.config as FPSConfig;
        const difficulty = cfg.difficulty ?? 'normal';
        const levels = this.getLevels();
        const levelData = levels[0];

        const freshState: FPSGameData = {
          level: 1,
          levelData,
          score: 0,
          kills: 0,
          totalEnemies: levelData.enemies.length,
          secretsFound: 0,
          totalSecrets: levelData.secrets.length,
          levelsCompleted: 0,
          totalLevels: data.secretLevelUnlocked ? levels.length : levels.length - 1,
          playerHealth: 100,
          playerArmor: 0,
          playerWeapons: ['Fist', 'Pistol'],
          difficulty,
          gameOver: false,
          secretLevelUnlocked: data.secretLevelUnlocked,
        };

        this.setData(freshState);
        this.emitEvent('game_restarted', playerId, { level: 1 });
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FPSGameData>();
    if (data.gameOver) return true;

    // Game ends when all main levels are completed
    const levels = this.getLevels();
    const mainLevels = levels.length - 1;
    return data.levelsCompleted >= mainLevels;
  }

  protected determineWinner(): string | null {
    // Single-player game: the player wins if they completed all levels
    const data = this.getData<FPSGameData>();
    if (data.gameOver && data.playerHealth <= 0) {
      return null; // Player died, no winner
    }
    return this.getPlayers()[0] ?? null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<FPSGameData>();
    const playerId = this.getPlayers()[0];
    if (!playerId) return {};

    // Final score includes completion bonus
    const completionBonus = data.levelsCompleted * 5000;
    return { [playerId]: data.score + completionBonus };
  }
}

export default FPSGame;
