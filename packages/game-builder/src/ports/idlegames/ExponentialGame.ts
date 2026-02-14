/**
 * ExponentialGame: Generate numbers that grow exponentially.
 * Multiple prestige layers (infinity, eternity, reality),
 * each resetting progress but granting massive multipliers.
 * Upgrades increase the rate of number generation.
 *
 * Actions: generate, buy_upgrade, prestige, unlock
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface ExpUpgrade {
  id: string;
  name: string;
  level: number;
  baseCost: number;
  costGrowth: number;
  multiplier: number;
  [key: string]: unknown;
}

interface PrestigeLayer {
  id: string;
  name: string;
  threshold: number;
  currency: number;
  multiplier: number;
  count: number;
  unlocked: boolean;
  [key: string]: unknown;
}

interface ExponentialState {
  number: number;
  totalNumber: number;
  perTick: number;
  perClick: number;
  upgrades: ExpUpgrade[];
  prestigeLayers: PrestigeLayer[];
  globalMultiplier: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const UPGRADES: Array<{
  id: string;
  name: string;
  baseCost: number;
  costGrowth: number;
  multiplier: number;
}> = [
  { id: 'gen_1', name: 'Generator I', baseCost: 10, costGrowth: 1.5, multiplier: 1 },
  { id: 'gen_2', name: 'Generator II', baseCost: 100, costGrowth: 1.8, multiplier: 5 },
  { id: 'gen_3', name: 'Generator III', baseCost: 1000, costGrowth: 2, multiplier: 25 },
  { id: 'gen_4', name: 'Generator IV', baseCost: 10000, costGrowth: 2.2, multiplier: 100 },
  { id: 'gen_5', name: 'Generator V', baseCost: 100000, costGrowth: 2.5, multiplier: 500 },
  { id: 'gen_6', name: 'Generator VI', baseCost: 1000000, costGrowth: 3, multiplier: 2500 },
  { id: 'gen_7', name: 'Generator VII', baseCost: 1e8, costGrowth: 3.5, multiplier: 15000 },
  { id: 'gen_8', name: 'Generator VIII', baseCost: 1e11, costGrowth: 4, multiplier: 100000 },
];

const PRESTIGE_LAYERS: Array<{
  id: string;
  name: string;
  threshold: number;
}> = [
  { id: 'infinity', name: 'Infinity', threshold: 1e308 },
  { id: 'eternity', name: 'Eternity', threshold: 1e30 },
  { id: 'reality', name: 'Reality', threshold: 1e15 },
];

export class ExponentialGame extends BaseGame {
  readonly name = 'Exponential Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): ExponentialState {
    const upgrades: ExpUpgrade[] = UPGRADES.map((u) => ({
      ...u,
      level: 0,
    }));

    const prestigeLayers: PrestigeLayer[] = PRESTIGE_LAYERS.map((p) => ({
      ...p,
      currency: 0,
      multiplier: 1,
      count: 0,
      unlocked: p.id === 'infinity',
    }));

    return {
      number: 0,
      totalNumber: 0,
      perTick: 0,
      perClick: 1,
      upgrades,
      prestigeLayers,
      globalMultiplier: 1,
      tickCount: 0,
      score: 0,
    };
  }

  private upgradeCost(upgrade: ExpUpgrade): number {
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, upgrade.level));
  }

  private recalcRates(data: ExponentialState): void {
    let total = 0;
    for (const up of data.upgrades) {
      total += up.multiplier * up.level;
    }
    data.perTick = total * data.globalMultiplier;
    data.perClick = Math.max(1, Math.floor(data.globalMultiplier));
  }

  private recalcGlobalMultiplier(data: ExponentialState): void {
    let mult = 1;
    for (const layer of data.prestigeLayers) {
      if (layer.count > 0) {
        mult *= layer.multiplier;
      }
    }
    data.globalMultiplier = mult;
  }

  private tickGeneration(data: ExponentialState): void {
    data.tickCount++;
    const gained = data.perTick;
    data.number += gained;
    data.totalNumber += gained;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ExponentialState>();

    this.tickGeneration(data);

    switch (action.type) {
      case 'generate': {
        const gained = data.perClick * data.globalMultiplier;
        data.number += gained;
        data.totalNumber += gained;
        data.score += 1;
        this.emitEvent('generate', playerId, { gained });
        break;
      }

      case 'buy_upgrade': {
        const upgradeId = String(action.payload.upgradeId);
        const upgrade = data.upgrades.find((u) => u.id === upgradeId);
        if (!upgrade) return { success: false, error: 'Unknown upgrade' };
        const cost = this.upgradeCost(upgrade);
        if (data.number < cost) return { success: false, error: 'Not enough points' };

        data.number -= cost;
        upgrade.level++;
        this.recalcRates(data);
        data.score += 10;
        this.emitEvent('buy_upgrade', playerId, { upgrade: upgrade.name, level: upgrade.level });
        break;
      }

      case 'prestige': {
        const layerId = String(action.payload.layerId ?? 'infinity');
        const layer = data.prestigeLayers.find((l) => l.id === layerId);
        if (!layer) return { success: false, error: 'Unknown prestige layer' };
        if (!layer.unlocked) return { success: false, error: 'Layer not unlocked' };

        // Check threshold
        if (layerId === 'infinity') {
          if (data.number < layer.threshold && !isFinite(data.number)) {
            // Allow prestige when number has reached infinity (JS Infinity)
          } else if (data.number < layer.threshold && data.totalNumber < layer.threshold) {
            return {
              success: false,
              error: `Need to reach ${layer.threshold} (or Infinity)`,
            };
          }
        } else if (layerId === 'eternity') {
          const infinityLayer = data.prestigeLayers.find((l) => l.id === 'infinity');
          if (!infinityLayer || infinityLayer.currency < layer.threshold) {
            return { success: false, error: `Need ${layer.threshold} infinity points` };
          }
        } else if (layerId === 'reality') {
          const eternityLayer = data.prestigeLayers.find((l) => l.id === 'eternity');
          if (!eternityLayer || eternityLayer.currency < layer.threshold) {
            return { success: false, error: `Need ${layer.threshold} eternity points` };
          }
        }

        // Calculate prestige currency earned
        let earned: number;
        if (layerId === 'infinity') {
          earned = Math.max(1, Math.floor(Math.log10(Math.max(1, data.totalNumber))));
        } else if (layerId === 'eternity') {
          const infLayer = data.prestigeLayers.find((l) => l.id === 'infinity');
          earned = Math.max(1, Math.floor(Math.log10(Math.max(1, infLayer?.currency ?? 1))));
        } else {
          const etLayer = data.prestigeLayers.find((l) => l.id === 'eternity');
          earned = Math.max(1, Math.floor(Math.log10(Math.max(1, etLayer?.currency ?? 1))));
        }

        layer.count++;
        layer.currency += earned;
        layer.multiplier =
          1 + layer.currency * (layerId === 'infinity' ? 1 : layerId === 'eternity' ? 10 : 100);

        // Reset lower layers
        if (layerId === 'eternity' || layerId === 'reality') {
          const infLayer = data.prestigeLayers.find((l) => l.id === 'infinity');
          if (infLayer) {
            infLayer.currency = 0;
            infLayer.count = 0;
            infLayer.multiplier = 1;
          }
        }
        if (layerId === 'reality') {
          const etLayer = data.prestigeLayers.find((l) => l.id === 'eternity');
          if (etLayer) {
            etLayer.currency = 0;
            etLayer.count = 0;
            etLayer.multiplier = 1;
          }
        }

        // Reset base state
        data.number = 0;
        data.totalNumber = 0;
        for (const up of data.upgrades) {
          up.level = 0;
        }

        this.recalcGlobalMultiplier(data);
        this.recalcRates(data);
        data.score += 200 * (layerId === 'infinity' ? 1 : layerId === 'eternity' ? 10 : 100);
        this.emitEvent('prestige', playerId, {
          layer: layer.name,
          earned,
          totalCurrency: layer.currency,
        });
        break;
      }

      case 'unlock': {
        const layerId = String(action.payload.layerId);
        const layer = data.prestigeLayers.find((l) => l.id === layerId);
        if (!layer) return { success: false, error: 'Unknown layer' };
        if (layer.unlocked) return { success: false, error: 'Layer already unlocked' };

        // Unlock requires previous layer prestige count
        if (layerId === 'eternity') {
          const infLayer = data.prestigeLayers.find((l) => l.id === 'infinity');
          if (!infLayer || infLayer.count < 5) {
            return { success: false, error: 'Need 5 infinity prestiges to unlock eternity' };
          }
        } else if (layerId === 'reality') {
          const etLayer = data.prestigeLayers.find((l) => l.id === 'eternity');
          if (!etLayer || etLayer.count < 5) {
            return { success: false, error: 'Need 5 eternity prestiges to unlock reality' };
          }
        }

        layer.unlocked = true;
        data.score += 500;
        this.emitEvent('unlock', playerId, { layer: layer.name });
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ExponentialState>();
    const reality = data.prestigeLayers.find((l) => l.id === 'reality');
    return (reality?.count ?? 0) >= 3;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ExponentialState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
