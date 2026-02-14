/**
 * AntimatterGame: Generate antimatter through dimensional layers.
 * Each dimension produces the one below it. Buy dimensions, dimension
 * boosts, and galaxies to scale production exponentially.
 *
 * Actions: buy_dimension, boost, galaxy, sacrifice
 * Single player idle/incremental game.
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Dimension {
  tier: number;
  amount: number;
  bought: number;
  multiplier: number;
  baseCost: number;
  [key: string]: unknown;
}

interface AntimatterState {
  antimatter: number;
  totalAntimatter: number;
  dimensions: Dimension[];
  dimensionBoosts: number;
  galaxies: number;
  tickSpeedMultiplier: number;
  sacrificeMultiplier: number;
  sacrificeCount: number;
  tickCount: number;
  score: number;
  [key: string]: unknown;
}

const BASE_COSTS = [10, 100, 1e4, 1e6, 1e9, 1e13, 1e18, 1e24];
const COST_MULTIPLIER = 1e3;

export class AntimatterGame extends BaseGame {
  readonly name = 'Antimatter Dimensions';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): AntimatterState {
    const dimensions: Dimension[] = [];
    for (let i = 0; i < 8; i++) {
      dimensions.push({
        tier: i + 1,
        amount: 0,
        bought: 0,
        multiplier: 1,
        baseCost: BASE_COSTS[i],
      });
    }

    return {
      antimatter: 10,
      totalAntimatter: 10,
      dimensions,
      dimensionBoosts: 0,
      galaxies: 0,
      tickSpeedMultiplier: 1,
      sacrificeMultiplier: 1,
      sacrificeCount: 0,
      tickCount: 0,
      score: 0,
    };
  }

  private dimensionCost(dim: Dimension): number {
    return dim.baseCost * Math.pow(COST_MULTIPLIER, dim.bought);
  }

  private tickProduction(data: AntimatterState): void {
    data.tickCount++;
    const tickMult = data.tickSpeedMultiplier;

    // Higher dimensions produce the next lower dimension
    for (let i = 7; i >= 1; i--) {
      const producer = data.dimensions[i];
      const target = data.dimensions[i - 1];
      target.amount += producer.amount * producer.multiplier * tickMult * 0.1;
    }

    // First dimension produces antimatter
    const d1 = data.dimensions[0];
    const produced = d1.amount * d1.multiplier * tickMult * data.sacrificeMultiplier;
    data.antimatter += produced;
    data.totalAntimatter += produced;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<AntimatterState>();

    this.tickProduction(data);

    switch (action.type) {
      case 'buy_dimension': {
        const tier = Number(action.payload.tier);
        if (tier < 1 || tier > 8)
          return { success: false, error: 'Invalid dimension tier (1 to 8)' };

        // Dimensions beyond 4 require dimension boosts to unlock
        const requiredBoosts = Math.max(0, tier - 4);
        if (data.dimensionBoosts < requiredBoosts) {
          return {
            success: false,
            error: `Need ${requiredBoosts} dimension boosts to unlock tier ${tier}`,
          };
        }

        const dim = data.dimensions[tier - 1];
        const cost = this.dimensionCost(dim);
        if (data.antimatter < cost) return { success: false, error: 'Not enough antimatter' };

        data.antimatter -= cost;
        dim.amount += 1;
        dim.bought += 1;

        // Every 10 purchases, the multiplier doubles
        if (dim.bought % 10 === 0) {
          dim.multiplier *= 2;
        }

        data.score += tier * 5;
        this.emitEvent('buy_dimension', playerId, { tier, bought: dim.bought });
        break;
      }

      case 'boost': {
        // Dimension boost requires 20 of the 4th dimension (or higher)
        const boostTier = Math.min(data.dimensionBoosts + 4, 8);
        const required = 20;
        const dim = data.dimensions[boostTier - 1];
        if (!dim || dim.amount < required) {
          return { success: false, error: `Need ${required} of dimension ${boostTier}` };
        }

        // Reset dimensions 1 through boostTier
        for (let i = 0; i < boostTier; i++) {
          data.dimensions[i].amount = 0;
          data.dimensions[i].bought = 0;
          data.dimensions[i].multiplier = 1;
        }
        data.antimatter = 10;
        data.dimensionBoosts++;

        // Each boost multiplies all dimension production
        for (const d of data.dimensions) {
          d.multiplier *= 2;
        }

        data.score += 100;
        this.emitEvent('dimension_boost', playerId, { boosts: data.dimensionBoosts });
        break;
      }

      case 'galaxy': {
        // Antimatter galaxy: requires 80 + 60*(galaxies) 8th dimensions
        const needed = 80 + 60 * data.galaxies;
        const d8 = data.dimensions[7];
        if (d8.amount < needed) {
          return { success: false, error: `Need ${needed} 8th dimensions` };
        }

        // Full reset of dimensions
        for (const d of data.dimensions) {
          d.amount = 0;
          d.bought = 0;
          d.multiplier = 1;
        }
        data.antimatter = 10;
        data.dimensionBoosts = 0;
        data.galaxies++;

        // Each galaxy improves tick speed
        data.tickSpeedMultiplier = 1 + data.galaxies * 0.5;

        data.score += 500;
        this.emitEvent('galaxy', playerId, { galaxies: data.galaxies });
        break;
      }

      case 'sacrifice': {
        // Sacrifice all dimensions except the 8th for a production multiplier
        const d8 = data.dimensions[7];
        if (d8.amount < 1) {
          return { success: false, error: 'Need at least 1 eighth dimension' };
        }

        let totalSacrificed = 0;
        for (let i = 0; i < 7; i++) {
          totalSacrificed += data.dimensions[i].amount;
          data.dimensions[i].amount = 0;
        }

        if (totalSacrificed < 1) {
          return { success: false, error: 'Nothing to sacrifice' };
        }

        data.sacrificeCount++;
        // Sacrifice multiplier grows based on total sacrificed amount
        data.sacrificeMultiplier =
          1 + Math.log10(Math.max(1, totalSacrificed)) * data.sacrificeCount;

        data.score += 200;
        this.emitEvent('sacrifice', playerId, {
          sacrificed: totalSacrificed,
          multiplier: data.sacrificeMultiplier,
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
    const data = this.getData<AntimatterState>();
    return data.totalAntimatter >= 1e308;
  }

  protected determineWinner(): string | null {
    if (this.checkGameOver()) return this.getPlayers()[0];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<AntimatterState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
