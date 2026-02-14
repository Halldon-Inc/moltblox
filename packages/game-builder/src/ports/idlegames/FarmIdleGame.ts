import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Plot {
  crop: string | null;
  growth: number;
  watered: boolean;
}

interface FarmState {
  [key: string]: unknown;
  plots: Plot[];
  money: number;
  totalMoney: number;
  inventory: Record<string, number>;
  target: number;
}

export class FarmIdleGame extends BaseGame {
  readonly name = 'Farm Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): FarmState {
    return {
      plots: Array.from({ length: 6 }, () => ({ crop: null, growth: 0, watered: false })),
      money: 20,
      totalMoney: 20,
      inventory: {},
      target: 500,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<FarmState>();
    const crops: Record<string, { cost: number; value: number; growTime: number }> = {
      wheat: { cost: 5, value: 15, growTime: 3 },
      corn: { cost: 10, value: 30, growTime: 5 },
      tomato: { cost: 15, value: 50, growTime: 7 },
    };

    if (action.type === 'plant') {
      const plotId = Number(action.payload.plotId);
      const cropType = action.payload.cropType as string;
      if (plotId < 0 || plotId >= d.plots.length) return { success: false, error: 'Invalid plot' };
      if (d.plots[plotId].crop) return { success: false, error: 'Plot occupied' };
      const c = crops[cropType];
      if (!c) return { success: false, error: 'Unknown crop' };
      if (d.money < c.cost) return { success: false, error: 'Not enough money' };
      d.money -= c.cost;
      d.plots[plotId] = { crop: cropType, growth: 0, watered: false };
    } else if (action.type === 'water') {
      const plotId = Number(action.payload.plotId);
      if (plotId < 0 || plotId >= d.plots.length || !d.plots[plotId].crop)
        return { success: false, error: 'Nothing to water' };
      d.plots[plotId].watered = true;
    } else if (action.type === 'harvest') {
      const plotId = Number(action.payload.plotId);
      if (plotId < 0 || plotId >= d.plots.length) return { success: false, error: 'Invalid plot' };
      const plot = d.plots[plotId];
      if (!plot.crop) return { success: false, error: 'Nothing to harvest' };
      const c = crops[plot.crop];
      if (!c || plot.growth < c.growTime) return { success: false, error: 'Not ready' };
      d.inventory[plot.crop] = (d.inventory[plot.crop] || 0) + 1;
      d.plots[plotId] = { crop: null, growth: 0, watered: false };
    } else if (action.type === 'sell') {
      const cropType = action.payload.cropType as string;
      if (!d.inventory[cropType] || d.inventory[cropType] <= 0)
        return { success: false, error: 'None to sell' };
      const c = crops[cropType];
      if (!c) return { success: false, error: 'Unknown crop' };
      const earned = d.inventory[cropType] * c.value;
      d.money += earned;
      d.totalMoney += earned;
      d.inventory[cropType] = 0;
    } else {
      return { success: false, error: 'Use plant, water, harvest, or sell' };
    }

    // Growth tick
    for (const plot of d.plots) {
      if (plot.crop) {
        plot.growth += plot.watered ? 2 : 1;
        plot.watered = false;
      }
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<FarmState>().totalMoney >= this.getData<FarmState>().target;
  }
  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<FarmState>().totalMoney };
  }
}
