/**
 * BrawlerGame - Side-scrolling beat-em-up
 *
 * Streets of Rage / Final Fight style brawler with stages, waves,
 * weapon pickups, combo system, and multiple enemy types.
 *
 * Players fight through stages of enemy waves, picking up weapons
 * and chaining combos for increased damage. Supports 1-4 co-op players.
 *
 * Actions: move, attack, jump_attack, grab, throw, use_weapon,
 *          special, pick_up
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BrawlerConfig {
  stageCount?: number;
  enemyDensity?: number;
  weaponSpawnRate?: number;
  coopPlayers?: number;
}

interface BrawlerPlayer {
  hp: number;
  maxHp: number;
  x: number;
  score: number;
  weapon: string | null;
  comboCount: number;
  lives: number;
  lastAction: string | null;
  [key: string]: unknown;
}

interface BrawlerEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  x: number;
  alive: boolean;
  [key: string]: unknown;
}

interface BrawlerWeapon {
  id: string;
  type: string;
  x: number;
  damage: number;
  durability: number;
  [key: string]: unknown;
}

interface BrawlerState {
  players: Record<string, BrawlerPlayer>;
  currentStage: number;
  totalStages: number;
  enemies: BrawlerEnemy[];
  currentWave: number;
  wavesPerStage: number;
  weapons: BrawlerWeapon[];
  gameOver: boolean;
  stageCleared: boolean;
  [key: string]: unknown;
}

const ENEMY_TEMPLATES: Record<string, { hp: number; atk: number }> = {
  Thug: { hp: 20, atk: 4 },
  Bruiser: { hp: 40, atk: 7 },
  Knife: { hp: 25, atk: 10 },
  Boss: { hp: 80, atk: 12 },
};

const WEAPON_TYPES: Record<string, { damage: number; durability: number }> = {
  pipe: { damage: 12, durability: 5 },
  bat: { damage: 15, durability: 4 },
  chain: { damage: 10, durability: 8 },
};

const BASE_ATTACK_DAMAGE = 8;
const JUMP_ATTACK_DAMAGE = 12;
const GRAB_DAMAGE = 6;
const THROW_DAMAGE = 15;
const SPECIAL_DAMAGE = 20;
const SPECIAL_HP_COST = 20;

export class BrawlerGame extends BaseGame {
  readonly name = 'Brawler';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): BrawlerState {
    const cfg = this.config as BrawlerConfig;
    const totalStages = cfg.stageCount ?? 3;
    const enemyDensity = cfg.enemyDensity ?? 3;
    const weaponSpawnRate = cfg.weaponSpawnRate ?? 0.3;

    const players: Record<string, BrawlerPlayer> = {};
    for (const pid of playerIds) {
      players[pid] = {
        hp: 100,
        maxHp: 100,
        x: 0,
        score: 0,
        weapon: null,
        comboCount: 0,
        lives: 3,
        lastAction: null,
      };
    }

    const state: BrawlerState = {
      players,
      currentStage: 1,
      totalStages,
      enemies: [],
      currentWave: 1,
      wavesPerStage: 3,
      weapons: [],
      gameOver: false,
      stageCleared: false,
    };

    this.spawnWave(state, enemyDensity, 1);
    this.maybeSpawnWeapon(state, weaponSpawnRate);

    return state;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BrawlerState>();

    if (data.gameOver) {
      return { success: false, error: 'Game is already over' };
    }

    const player = data.players[playerId];
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (player.hp <= 0) {
      return { success: false, error: 'Player is knocked out' };
    }

    switch (action.type) {
      case 'move':
        return this.handleMove(playerId, action, data);
      case 'attack':
        return this.handleAttack(playerId, data);
      case 'jump_attack':
        return this.handleJumpAttack(playerId, data);
      case 'grab':
        return this.handleGrab(playerId, action, data);
      case 'throw':
        return this.handleThrow(playerId, action, data);
      case 'use_weapon':
        return this.handleUseWeapon(playerId, data);
      case 'special':
        return this.handleSpecial(playerId, data);
      case 'pick_up':
        return this.handlePickUp(playerId, action, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(playerId: string, action: GameAction, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const direction = action.payload.direction as string;

    switch (direction) {
      case 'left':
        player.x = Math.max(0, player.x - 1);
        break;
      case 'right':
        player.x = player.x + 1;
        break;
      case 'up':
      case 'down':
        break;
      default:
        return { success: false, error: 'Invalid direction' };
    }

    player.comboCount = 0;
    player.lastAction = 'move';
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleAttack(playerId: string, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const aliveEnemies = data.enemies.filter((e) => e.alive);

    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies to attack' };
    }

    const target = aliveEnemies[0];
    let damage = BASE_ATTACK_DAMAGE;

    damage = this.applyCombo(player, 'attack', damage);

    target.hp -= damage;
    player.score += damage;

    this.emitEvent('attack', playerId, {
      target: target.id,
      damage,
      combo: player.comboCount,
    });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      player.score += 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id, name: target.name });
    }

    this.enemyCounterattack(data, playerId);
    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleJumpAttack(playerId: string, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const aliveEnemies = data.enemies.filter((e) => e.alive);

    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies to attack' };
    }

    const target = aliveEnemies[0];
    let damage = JUMP_ATTACK_DAMAGE;

    damage = this.applyCombo(player, 'jump_attack', damage);

    target.hp -= damage;
    player.score += damage;

    this.emitEvent('jump_attack', playerId, {
      target: target.id,
      damage,
      combo: player.comboCount,
    });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      player.score += 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id });
    }

    this.enemyCounterattack(data, playerId);
    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleGrab(playerId: string, action: GameAction, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const targetId = action.payload.targetId as string;
    const target = data.enemies.find((e) => e.id === targetId && e.alive);

    if (!target) {
      return { success: false, error: 'Target not found or already defeated' };
    }

    let damage = GRAB_DAMAGE;
    damage = this.applyCombo(player, 'grab', damage);

    target.hp -= damage;
    player.score += damage;

    this.emitEvent('grab', playerId, { target: target.id, damage });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      player.score += 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id });
    }

    this.enemyCounterattack(data, playerId);
    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleThrow(playerId: string, action: GameAction, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const targetId = action.payload.targetId as string;
    const target = data.enemies.find((e) => e.id === targetId && e.alive);

    if (!target) {
      return { success: false, error: 'Target not found or already defeated' };
    }

    let damage = THROW_DAMAGE;
    damage = this.applyCombo(player, 'throw', damage);

    target.hp -= damage;
    player.score += damage;

    this.emitEvent('throw', playerId, { target: target.id, damage });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      player.score += 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id });
    }

    this.enemyCounterattack(data, playerId);
    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUseWeapon(playerId: string, data: BrawlerState): ActionResult {
    const player = data.players[playerId];

    if (!player.weapon) {
      return { success: false, error: 'No weapon equipped' };
    }

    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) {
      return { success: false, error: 'No enemies to attack' };
    }

    const weaponInfo = WEAPON_TYPES[player.weapon];
    if (!weaponInfo) {
      return { success: false, error: 'Invalid weapon type' };
    }

    const target = aliveEnemies[0];
    let damage = weaponInfo.damage;
    damage = this.applyCombo(player, 'use_weapon', damage);

    target.hp -= damage;
    player.score += damage;

    // Find the weapon in state and reduce durability
    const weaponInState = data.weapons.find((w) => w.type === player.weapon && w.durability > 0);
    if (weaponInState) {
      weaponInState.durability--;
      if (weaponInState.durability <= 0) {
        player.weapon = null;
        this.emitEvent('weapon_broke', playerId, { type: weaponInState.type });
      }
    } else {
      // Weapon from a pickup that is no longer tracked; just decrement conceptually
      player.weapon = null;
    }

    this.emitEvent('weapon_attack', playerId, {
      target: target.id,
      damage,
      weaponType: player.weapon,
    });

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      player.score += 50;
      this.emitEvent('enemy_defeated', playerId, { enemy: target.id });
    }

    this.enemyCounterattack(data, playerId);
    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSpecial(playerId: string, data: BrawlerState): ActionResult {
    const player = data.players[playerId];

    if (player.hp <= SPECIAL_HP_COST) {
      return { success: false, error: 'Not enough HP for special attack' };
    }

    player.hp -= SPECIAL_HP_COST;

    const aliveEnemies = data.enemies.filter((e) => e.alive);
    for (const enemy of aliveEnemies) {
      enemy.hp -= SPECIAL_DAMAGE;
      player.score += SPECIAL_DAMAGE;
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        enemy.alive = false;
        player.score += 50;
        this.emitEvent('enemy_defeated', playerId, { enemy: enemy.id });
      }
    }

    player.comboCount = 0;
    player.lastAction = 'special';

    this.emitEvent('special', playerId, { damage: SPECIAL_DAMAGE, hpCost: SPECIAL_HP_COST });

    this.checkWaveClear(data);

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handlePickUp(playerId: string, action: GameAction, data: BrawlerState): ActionResult {
    const player = data.players[playerId];
    const weaponId = action.payload.weaponId as string;
    const weapon = data.weapons.find((w) => w.id === weaponId && w.durability > 0);

    if (!weapon) {
      return { success: false, error: 'Weapon not found or already used up' };
    }

    player.weapon = weapon.type;
    this.emitEvent('weapon_pickup', playerId, { weaponType: weapon.type, damage: weapon.damage });

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private applyCombo(player: BrawlerPlayer, actionType: string, baseDamage: number): number {
    if (player.lastAction && player.lastAction !== actionType && player.lastAction !== 'move') {
      player.comboCount++;
      const multiplier = 1 + player.comboCount * 0.15;
      player.lastAction = actionType;
      return Math.floor(baseDamage * multiplier);
    }
    player.comboCount = 0;
    player.lastAction = actionType;
    return baseDamage;
  }

  private enemyCounterattack(data: BrawlerState, playerId: string): void {
    const player = data.players[playerId];
    const aliveEnemies = data.enemies.filter((e) => e.alive);

    for (const enemy of aliveEnemies) {
      player.hp -= enemy.atk;
      if (player.hp <= 0) {
        player.hp = 0;
        player.lives--;
        if (player.lives > 0) {
          player.hp = player.maxHp;
          this.emitEvent('life_lost', playerId, { livesRemaining: player.lives });
        } else {
          this.emitEvent('player_ko', playerId, {});
          this.checkAllPlayersDown(data);
        }
        break;
      }
    }
  }

  private checkAllPlayersDown(data: BrawlerState): void {
    const anyAlive = Object.values(data.players).some((p) => p.hp > 0 || p.lives > 0);
    if (!anyAlive) {
      data.gameOver = true;
      this.emitEvent('game_over', undefined, { result: 'defeat' });
    }
  }

  private checkWaveClear(data: BrawlerState): void {
    if (data.gameOver) return;

    const aliveEnemies = data.enemies.filter((e) => e.alive);
    if (aliveEnemies.length > 0) return;

    const cfg = this.config as BrawlerConfig;
    const enemyDensity = cfg.enemyDensity ?? 3;
    const weaponSpawnRate = cfg.weaponSpawnRate ?? 0.3;

    if (data.currentWave < data.wavesPerStage) {
      data.currentWave++;
      this.emitEvent('wave_cleared', undefined, {
        stage: data.currentStage,
        wave: data.currentWave - 1,
      });
      this.spawnWave(data, enemyDensity, data.currentStage);
      this.maybeSpawnWeapon(data, weaponSpawnRate);
    } else {
      // Stage cleared
      data.stageCleared = true;
      this.emitEvent('stage_cleared', undefined, { stage: data.currentStage });

      if (data.currentStage >= data.totalStages) {
        data.gameOver = true;
        this.emitEvent('victory', undefined, {});
      } else {
        data.currentStage++;
        data.currentWave = 1;
        data.stageCleared = false;
        this.spawnWave(data, enemyDensity, data.currentStage);
        this.maybeSpawnWeapon(data, weaponSpawnRate);
      }
    }
  }

  private spawnWave(data: BrawlerState, enemyDensity: number, stage: number): void {
    const enemies: BrawlerEnemy[] = [];
    const types =
      stage >= data.totalStages && data.currentWave >= data.wavesPerStage
        ? ['Boss']
        : this.getEnemyTypesForStage(stage, enemyDensity);

    for (let i = 0; i < types.length; i++) {
      const typeName = types[i];
      const template = ENEMY_TEMPLATES[typeName];
      enemies.push({
        id: `enemy_s${stage}_w${data.currentWave}_${i}`,
        name: typeName,
        hp: template.hp,
        maxHp: template.hp,
        atk: template.atk,
        x: 5 + i * 2,
        alive: true,
      });
    }

    data.enemies = enemies;
  }

  private getEnemyTypesForStage(stage: number, density: number): string[] {
    const types: string[] = [];
    for (let i = 0; i < density; i++) {
      if (stage === 1) {
        types.push('Thug');
      } else if (stage === 2) {
        types.push(i === 0 ? 'Bruiser' : 'Thug');
      } else {
        if (i === 0) types.push('Bruiser');
        else if (i === 1) types.push('Knife');
        else types.push('Thug');
      }
    }
    return types;
  }

  private maybeSpawnWeapon(data: BrawlerState, rate: number): void {
    if (Math.random() < rate) {
      const weaponTypes = Object.keys(WEAPON_TYPES);
      const chosen = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
      const info = WEAPON_TYPES[chosen];
      data.weapons.push({
        id: `weapon_s${data.currentStage}_w${data.currentWave}`,
        type: chosen,
        x: 3,
        damage: info.damage,
        durability: info.durability,
      });
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<BrawlerState>();
    return data.gameOver;
  }

  protected determineWinner(): string | null {
    const data = this.getData<BrawlerState>();

    // Victory: all stages cleared
    if (data.currentStage >= data.totalStages && data.stageCleared) {
      // The player with the highest score wins
      let best: string | null = null;
      let bestScore = -1;
      for (const [pid, p] of Object.entries(data.players)) {
        if (p.score > bestScore) {
          bestScore = p.score;
          best = pid;
        }
      }
      return best;
    }

    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BrawlerState>();
    const scores: Record<string, number> = {};
    for (const [pid, p] of Object.entries(data.players)) {
      scores[pid] = p.score;
    }
    return scores;
  }
}
