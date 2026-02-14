import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface NumberState {
  [key: string]: unknown;
  value: number;
  totalValue: number;
  multiplier: number;
  clickPower: number;
  prestigeCount: number;
  target: number;
}

export class NumberIdleGame extends BaseGame {
  readonly name = 'Number Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): NumberState {
    return {
      value: 0,
      totalValue: 0,
      multiplier: 1,
      clickPower: 1,
      prestigeCount: 0,
      target: 10000,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<NumberState>();

    if (action.type === 'click') {
      const gain = d.clickPower * d.multiplier;
      d.value += gain;
      d.totalValue += gain;
    } else if (action.type === 'buy') {
      const mult = action.payload.multiplier as string;
      if (mult === 'click') {
        const cost = d.clickPower * 100;
        if (d.value < cost) return { success: false, error: 'Not enough' };
        d.value -= cost;
        d.clickPower++;
      } else if (mult === 'multiplier') {
        const cost = d.multiplier * 500;
        if (d.value < cost) return { success: false, error: 'Not enough' };
        d.value -= cost;
        d.multiplier++;
      } else {
        return { success: false, error: 'Unknown multiplier' };
      }
    } else if (action.type === 'prestige') {
      if (d.value < 1000) return { success: false, error: 'Need at least 1000 to prestige' };
      d.prestigeCount++;
      d.multiplier = 1 + d.prestigeCount;
      d.clickPower = 1;
      d.value = 0;
    } else {
      return { success: false, error: 'Use click, buy, or prestige' };
    }

    // Passive gain
    d.value += d.multiplier;
    d.totalValue += d.multiplier;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<NumberState>().totalValue >= this.getData<NumberState>().target;
  }
  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<NumberState>().totalValue };
  }
}
