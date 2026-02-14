import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Building {
  id: number;
  type: string;
  level: number;
  income: number;
}

interface CityState {
  [key: string]: unknown;
  money: number;
  totalMoney: number;
  population: number;
  buildings: Building[];
  nextId: number;
  target: number;
}

export class CityBuilderIdleGame extends BaseGame {
  readonly name = 'City Builder Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): CityState {
    return {
      money: 100,
      totalMoney: 100,
      population: 10,
      buildings: [],
      nextId: 1,
      target: 2000,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<CityState>();
    const types: Record<string, { cost: number; income: number; pop: number }> = {
      house: { cost: 30, income: 5, pop: 10 },
      shop: { cost: 80, income: 15, pop: 2 },
      factory: { cost: 200, income: 40, pop: 5 },
      park: { cost: 50, income: 2, pop: 20 },
    };

    if (action.type === 'build') {
      const bt = action.payload.buildingType as string;
      const def = types[bt];
      if (!def) return { success: false, error: 'Unknown building type' };
      if (d.money < def.cost) return { success: false, error: 'Not enough money' };
      d.money -= def.cost;
      d.buildings.push({ id: d.nextId++, type: bt, level: 1, income: def.income });
      d.population += def.pop;
    } else if (action.type === 'upgrade') {
      const buildingId = Number(action.payload.buildingId);
      const b = d.buildings.find((x) => x.id === buildingId);
      if (!b) return { success: false, error: 'Building not found' };
      const cost = b.level * 50;
      if (d.money < cost) return { success: false, error: 'Not enough money' };
      d.money -= cost;
      b.level++;
      b.income = Math.floor(b.income * 1.5);
    } else if (action.type === 'collect') {
      const tax = d.buildings.reduce((s, b) => s + b.income, 0);
      d.money += tax;
      d.totalMoney += tax;
    } else {
      return { success: false, error: 'Use build, upgrade, or collect' };
    }

    // Passive population growth
    d.population += Math.floor(d.buildings.length * 0.5);

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<CityState>().totalMoney >= this.getData<CityState>().target;
  }
  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<CityState>();
    return { [this.getPlayers()[0]]: d.totalMoney + d.population };
  }
}
