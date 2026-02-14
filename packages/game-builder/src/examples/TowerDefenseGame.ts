/**
 * TowerDefenseGame - Grid path tower defense
 *
 * Place towers on a grid to defend against waves of creeps.
 * Tower types: basic, sniper, splash, slow.
 * Actions: place_tower, upgrade_tower, sell_tower, start_wave.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TowerDefenseConfig {
  gridSize?: number;
  waveCount?: number;
  startingGold?: number;
  creepSpeed?: number;
}

interface Tower {
  id: string;
  type: 'basic' | 'sniper' | 'splash' | 'slow';
  x: number;
  y: number;
  level: number;
  damage: number;
  range: number;
  [key: string]: unknown;
}

interface Creep {
  id: string;
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number;
  alive: boolean;
  slowTimer: number;
  goldReward: number;
  [key: string]: unknown;
}

interface TDState {
  gridSize: number;
  waveCount: number;
  path: { x: number; y: number }[];
  towers: Tower[];
  creeps: Creep[];
  gold: number;
  lives: number;
  currentWave: number;
  waveInProgress: boolean;
  score: number;
  gameResult: 'playing' | 'won' | 'lost';
  [key: string]: unknown;
}

const TOWER_STATS: Record<string, { cost: number; damage: number; range: number }> = {
  basic: { cost: 50, damage: 10, range: 2 },
  sniper: { cost: 100, damage: 30, range: 4 },
  splash: { cost: 80, damage: 8, range: 2 },
  slow: { cost: 60, damage: 5, range: 3 },
};

const UPGRADE_COST_MULTIPLIER = 1.5;

export class TowerDefenseGame extends BaseGame {
  readonly name = 'Tower Defense';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): TDState {
    const cfg = this.config as TowerDefenseConfig;
    const gridSize = cfg.gridSize ?? 8;
    const waveCount = cfg.waveCount ?? 10;
    const startingGold = cfg.startingGold ?? 200;

    // Generate a simple path from left to right across the grid
    const path = this.generatePath(gridSize);

    return {
      gridSize,
      waveCount,
      path,
      towers: [],
      creeps: [],
      gold: startingGold,
      lives: 20,
      currentWave: 0,
      waveInProgress: false,
      score: 0,
      gameResult: 'playing',
      playerId: playerIds[0],
    };
  }

  private generatePath(gridSize: number): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    const midY = Math.floor(gridSize / 2);
    // Zigzag path across grid
    for (let x = 0; x < gridSize; x++) {
      if (x % 4 < 2) {
        path.push({ x, y: midY });
      } else {
        path.push({ x, y: midY + 1 });
      }
    }
    return path;
  }

  private isOnPath(x: number, y: number, path: { x: number; y: number }[]): boolean {
    return path.some((p) => p.x === x && p.y === y);
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TDState>();

    if (data.gameResult !== 'playing') {
      return { success: false, error: 'Game is over' };
    }

    switch (action.type) {
      case 'place_tower':
        return this.handlePlaceTower(playerId, action, data);
      case 'upgrade_tower':
        return this.handleUpgradeTower(playerId, action, data);
      case 'sell_tower':
        return this.handleSellTower(playerId, action, data);
      case 'start_wave':
        return this.handleStartWave(playerId, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handlePlaceTower(_playerId: string, action: GameAction, data: TDState): ActionResult {
    const x = Number(action.payload.x);
    const y = Number(action.payload.y);
    const towerType = String(action.payload.towerType || 'basic');

    if (isNaN(x) || isNaN(y) || x < 0 || x >= data.gridSize || y < 0 || y >= data.gridSize) {
      return { success: false, error: 'Invalid grid position' };
    }

    if (!TOWER_STATS[towerType]) {
      return { success: false, error: 'Invalid tower type' };
    }

    if (this.isOnPath(x, y, data.path)) {
      return { success: false, error: 'Cannot place tower on path' };
    }

    if (data.towers.some((t) => t.x === x && t.y === y)) {
      return { success: false, error: 'Cell already occupied' };
    }

    const stats = TOWER_STATS[towerType];
    if (data.gold < stats.cost) {
      return { success: false, error: 'Not enough gold' };
    }

    data.gold -= stats.cost;
    data.towers.push({
      id: `tower_${data.towers.length}`,
      type: towerType as Tower['type'],
      x,
      y,
      level: 1,
      damage: stats.damage,
      range: stats.range,
    });

    this.emitEvent('tower_placed', undefined, { towerType, x, y });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUpgradeTower(_playerId: string, action: GameAction, data: TDState): ActionResult {
    const towerId = String(action.payload.towerId);
    const tower = data.towers.find((t) => t.id === towerId);
    if (!tower) {
      return { success: false, error: 'Tower not found' };
    }

    const baseCost = TOWER_STATS[tower.type]?.cost ?? 50;
    const upgradeCost = Math.floor(baseCost * UPGRADE_COST_MULTIPLIER * tower.level);
    if (data.gold < upgradeCost) {
      return { success: false, error: 'Not enough gold' };
    }

    data.gold -= upgradeCost;
    tower.level++;
    tower.damage = Math.floor(tower.damage * 1.4);
    tower.range = tower.range + (tower.level % 2 === 0 ? 1 : 0);

    this.emitEvent('tower_upgraded', undefined, { towerId, level: tower.level });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleSellTower(_playerId: string, action: GameAction, data: TDState): ActionResult {
    const towerId = String(action.payload.towerId);
    const towerIndex = data.towers.findIndex((t) => t.id === towerId);
    if (towerIndex === -1) {
      return { success: false, error: 'Tower not found' };
    }

    const tower = data.towers[towerIndex];
    const baseCost = TOWER_STATS[tower.type]?.cost ?? 50;
    const refund = Math.floor(baseCost * 0.6 * tower.level);
    data.gold += refund;
    data.towers.splice(towerIndex, 1);

    this.emitEvent('tower_sold', undefined, { towerId, refund });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleStartWave(_playerId: string, data: TDState): ActionResult {
    if (data.waveInProgress) {
      return { success: false, error: 'Wave already in progress' };
    }
    if (data.currentWave >= data.waveCount) {
      return { success: false, error: 'All waves completed' };
    }

    data.currentWave++;
    data.waveInProgress = true;

    // Spawn creeps for this wave
    const creepCount = 3 + data.currentWave;
    const baseHp = 20 + data.currentWave * 15;
    const cfg = this.config as TowerDefenseConfig;
    const speed = cfg.creepSpeed ?? 1;

    data.creeps = [];
    for (let i = 0; i < creepCount; i++) {
      data.creeps.push({
        id: `creep_w${data.currentWave}_${i}`,
        hp: baseHp,
        maxHp: baseHp,
        speed,
        pathIndex: 0,
        alive: true,
        slowTimer: 0,
        goldReward: 5 + data.currentWave * 2,
      });
    }

    // Simulate the wave combat
    this.simulateWave(data);

    this.emitEvent('wave_started', undefined, { wave: data.currentWave, creepCount });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private simulateWave(data: TDState): void {
    // Simulate ticks until all creeps are dead or leaked
    let maxTicks = 200;
    while (maxTicks > 0 && data.creeps.some((c) => c.alive)) {
      maxTicks--;

      // Move creeps along path
      for (const creep of data.creeps) {
        if (!creep.alive) continue;
        const effectiveSpeed = creep.slowTimer > 0 ? Math.max(0.5, creep.speed * 0.5) : creep.speed;
        creep.pathIndex += effectiveSpeed;
        if (creep.slowTimer > 0) creep.slowTimer--;

        // Creep reached end of path
        if (creep.pathIndex >= data.path.length) {
          creep.alive = false;
          data.lives--;
          if (data.lives <= 0) {
            data.lives = 0;
            data.gameResult = 'lost';
            return;
          }
        }
      }

      // Towers attack creeps
      for (const tower of data.towers) {
        const aliveCreeps = data.creeps.filter((c) => c.alive && c.pathIndex < data.path.length);
        if (aliveCreeps.length === 0) break;

        // Find creeps in range
        const inRange = aliveCreeps.filter((c) => {
          const pathPos = data.path[Math.min(Math.floor(c.pathIndex), data.path.length - 1)];
          if (!pathPos) return false;
          const dist = Math.abs(tower.x - pathPos.x) + Math.abs(tower.y - pathPos.y);
          return dist <= tower.range;
        });

        if (inRange.length === 0) continue;

        if (tower.type === 'splash') {
          // Splash hits all in range
          for (const creep of inRange) {
            creep.hp -= tower.damage;
            if (creep.hp <= 0) {
              creep.alive = false;
              data.gold += creep.goldReward;
              data.score += 10;
            }
          }
        } else if (tower.type === 'slow') {
          // Slow tower: damage + slow effect
          const target = inRange[0];
          target.hp -= tower.damage;
          target.slowTimer = 3;
          if (target.hp <= 0) {
            target.alive = false;
            data.gold += target.goldReward;
            data.score += 10;
          }
        } else {
          // Basic and sniper: single target (sniper prioritizes highest HP)
          const target =
            tower.type === 'sniper'
              ? inRange.reduce((best, c) => (c.hp > best.hp ? c : best), inRange[0])
              : inRange[0];
          target.hp -= tower.damage;
          if (target.hp <= 0) {
            target.alive = false;
            data.gold += target.goldReward;
            data.score += 10;
          }
        }
      }
    }

    // Wave completed
    data.waveInProgress = false;
    data.score += 50;

    if (data.currentWave >= data.waveCount && data.lives > 0) {
      data.gameResult = 'won';
      data.score += data.lives * 20;
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TDState>();
    return data.gameResult !== 'playing';
  }

  protected determineWinner(): string | null {
    const data = this.getData<TDState>();
    if (data.gameResult === 'won') {
      return this.getPlayers()[0];
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TDState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
