/**
 * MineDefenseGame: Tower defense meets idle. Place mines on a grid
 * that damage enemies walking through. Earn gold from defeated
 * enemies, upgrade mine damage and range, and progress through
 * auto-advancing waves.
 *
 * Actions: place_mine, upgrade, sell_mine, next_wave
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface MineUnit {
  id: string;
  type: string;
  name: string;
  damage: number;
  range: number;
  level: number;
  position: number;
  [key: string]: unknown;
}

interface MineType {
  type: string;
  name: string;
  baseDamage: number;
  baseRange: number;
  baseCost: number;
  [key: string]: unknown;
}

interface MineDefenseState {
  gold: number;
  totalGold: number;
  lives: number;
  maxLives: number;
  wave: number;
  waveInProgress: boolean;
  enemiesRemaining: number;
  enemiesDefeated: number;
  totalEnemiesDefeated: number;
  mines: MineUnit[];
  mineCounter: number;
  gridSize: number;
  mineTypes: MineType[];
  damageMultiplier: number;
  goldMultiplier: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const MINE_TYPES: MineType[] = [
  { type: 'basic', name: 'Basic Mine', baseDamage: 10, baseRange: 1, baseCost: 25 },
  { type: 'explosive', name: 'Explosive Mine', baseDamage: 25, baseRange: 2, baseCost: 75 },
  { type: 'shock', name: 'Shock Mine', baseDamage: 40, baseRange: 1, baseCost: 150 },
  { type: 'napalm', name: 'Napalm Mine', baseDamage: 15, baseRange: 3, baseCost: 200 },
  { type: 'nuclear', name: 'Nuclear Mine', baseDamage: 100, baseRange: 4, baseCost: 1000 },
];

export class MineDefenseGame extends BaseGame {
  readonly name = 'Mine Defense';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): MineDefenseState {
    return {
      gold: 100,
      totalGold: 100,
      lives: 20,
      maxLives: 20,
      wave: 0,
      waveInProgress: false,
      enemiesRemaining: 0,
      enemiesDefeated: 0,
      totalEnemiesDefeated: 0,
      mines: [],
      mineCounter: 0,
      gridSize: 20,
      mineTypes: MINE_TYPES.map((m) => ({ ...m })),
      damageMultiplier: 1,
      goldMultiplier: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private getEnemyHP(wave: number): number {
    return Math.floor(10 * Math.pow(1.2, wave));
  }

  private getEnemyCount(wave: number): number {
    return Math.floor(5 + wave * 2);
  }

  private getWaveGold(wave: number): number {
    return Math.floor(10 + wave * 5);
  }

  private tickWave(data: MineDefenseState): void {
    data.tickCount++;

    if (!data.waveInProgress) return;

    // Each tick, mines damage enemies
    const totalMineDamage =
      data.mines.reduce((sum, mine) => sum + mine.damage * mine.range, 0) * data.damageMultiplier;

    const enemyHP = this.getEnemyHP(data.wave);

    // Calculate how many enemies the mines can kill this tick
    const enemiesKilled = Math.min(
      data.enemiesRemaining,
      Math.max(1, Math.floor(totalMineDamage / enemyHP)),
    );

    data.enemiesRemaining -= enemiesKilled;
    data.enemiesDefeated += enemiesKilled;
    data.totalEnemiesDefeated += enemiesKilled;

    // Gold from kills
    const goldPerKill = this.getWaveGold(data.wave) * data.goldMultiplier;
    const goldEarned = goldPerKill * enemiesKilled;
    data.gold += goldEarned;
    data.totalGold += goldEarned;
    data.score += enemiesKilled * data.wave;

    // If enemies remain and no mine damage, they leak through
    if (data.enemiesRemaining > 0 && totalMineDamage < enemyHP) {
      const leaked = Math.min(data.enemiesRemaining, 1);
      data.enemiesRemaining -= leaked;
      data.lives -= leaked;
    }

    // Wave complete
    if (data.enemiesRemaining <= 0) {
      data.waveInProgress = false;
      // Bonus gold for wave completion
      const waveBonus = Math.floor(50 * Math.pow(1.1, data.wave));
      data.gold += waveBonus;
      data.totalGold += waveBonus;
      data.score += data.wave * 10;
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MineDefenseState>();

    this.tickWave(data);

    switch (action.type) {
      case 'place_mine': {
        const mineType = String(action.payload.mineType ?? 'basic');
        const position = Number(action.payload.position ?? data.mineCounter);
        const typeDef = data.mineTypes.find((m) => m.type === mineType);
        if (!typeDef) return { success: false, error: 'Unknown mine type' };

        if (position < 0 || position >= data.gridSize) {
          return { success: false, error: `Position out of range (0 to ${data.gridSize - 1})` };
        }

        // Check if position is occupied
        if (data.mines.some((m) => m.position === position)) {
          return { success: false, error: 'Position already occupied' };
        }

        if (data.gold < typeDef.baseCost) {
          return { success: false, error: 'Not enough gold' };
        }

        data.gold -= typeDef.baseCost;
        data.mineCounter++;
        const mine: MineUnit = {
          id: `mine_${data.mineCounter}`,
          type: mineType,
          name: typeDef.name,
          damage: typeDef.baseDamage,
          range: typeDef.baseRange,
          level: 1,
          position,
        };
        data.mines.push(mine);
        data.score += 5;
        this.emitEvent('place_mine', playerId, { mine: mine.name, position });
        break;
      }

      case 'upgrade': {
        const mineId = String(action.payload.mineId);
        const mine = data.mines.find((m) => m.id === mineId);
        if (!mine) return { success: false, error: 'Mine not found' };

        const typeDef = data.mineTypes.find((m) => m.type === mine.type);
        const upgradeCost = Math.floor((typeDef?.baseCost ?? 25) * Math.pow(1.5, mine.level));
        if (data.gold < upgradeCost) {
          return { success: false, error: 'Not enough gold' };
        }

        data.gold -= upgradeCost;
        mine.level++;
        mine.damage = Math.floor((typeDef?.baseDamage ?? 10) * mine.level * 1.2);

        // Every 5 levels, increase range
        if (mine.level % 5 === 0) {
          mine.range++;
        }

        data.score += 10;
        this.emitEvent('upgrade', playerId, {
          mine: mine.name,
          level: mine.level,
          damage: mine.damage,
        });
        break;
      }

      case 'sell_mine': {
        const mineId = String(action.payload.mineId);
        const idx = data.mines.findIndex((m) => m.id === mineId);
        if (idx === -1) return { success: false, error: 'Mine not found' };

        const mine = data.mines[idx];
        const typeDef = data.mineTypes.find((m) => m.type === mine.type);
        // Sell for 50% of total investment
        const sellValue = Math.floor((typeDef?.baseCost ?? 25) * mine.level * 0.5);
        data.gold += sellValue;
        data.mines.splice(idx, 1);

        this.emitEvent('sell_mine', playerId, { mine: mine.name, gold: sellValue });
        break;
      }

      case 'next_wave': {
        if (data.waveInProgress) {
          return { success: false, error: 'Wave already in progress' };
        }
        if (data.lives <= 0) {
          return { success: false, error: 'No lives remaining' };
        }

        data.wave++;
        data.waveInProgress = true;
        data.enemiesRemaining = this.getEnemyCount(data.wave);
        data.enemiesDefeated = 0;

        this.emitEvent('next_wave', playerId, {
          wave: data.wave,
          enemies: data.enemiesRemaining,
          enemyHP: this.getEnemyHP(data.wave),
        });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MineDefenseState>();
    return data.lives <= 0 || data.wave >= 100;
  }

  protected determineWinner(): string | null {
    const data = this.getData<MineDefenseState>();
    if (data.wave >= 100) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MineDefenseState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
