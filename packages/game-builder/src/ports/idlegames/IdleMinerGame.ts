import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface IdleMinerState {
  [key: string]: unknown;
  gold: number;
  totalGold: number;
  depth: number;
  pickaxeLevel: number;
  mineRate: number;
  targetGold: number;
}

export class IdleMinerGame extends BaseGame {
  readonly name = 'Idle Miner';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): IdleMinerState {
    return {
      gold: 0,
      totalGold: 0,
      depth: 1,
      pickaxeLevel: 1,
      mineRate: 1,
      targetGold: 500,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<IdleMinerState>();

    if (action.type === 'mine') {
      const earned = d.mineRate * d.depth;
      d.gold += earned;
      d.totalGold += earned;
    } else if (action.type === 'upgrade') {
      const type = action.payload.type as string;
      if (type === 'pickaxe') {
        const cost = d.pickaxeLevel * 50;
        if (d.gold < cost) return { success: false, error: 'Not enough gold' };
        d.gold -= cost;
        d.pickaxeLevel++;
        d.mineRate = d.pickaxeLevel * 2;
      } else {
        return { success: false, error: 'Unknown upgrade type' };
      }
    } else if (action.type === 'descend') {
      const cost = d.depth * 100;
      if (d.gold < cost) return { success: false, error: 'Not enough gold' };
      d.gold -= cost;
      d.depth++;
    } else {
      return { success: false, error: 'Use mine, upgrade, or descend' };
    }

    // Passive income
    d.gold += Math.floor(d.mineRate * 0.5);
    d.totalGold += Math.floor(d.mineRate * 0.5);

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<IdleMinerState>().totalGold >= this.getData<IdleMinerState>().targetGold;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<IdleMinerState>().totalGold };
  }
}
