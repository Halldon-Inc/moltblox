import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface TowerState {
  [key: string]: unknown;
  blocks: number[];
  currentWidth: number;
  maxHeight: number;
  score: number;
  fallen: boolean;
}

export class TowerStackGame extends BaseGame {
  readonly name = 'Tower Stack';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): TowerState {
    return {
      blocks: [5],
      currentWidth: 5,
      maxHeight: 20,
      score: 0,
      fallen: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'drop') return { success: false, error: 'Use drop action' };
    const d = this.getData<TowerState>();
    const offset = Math.floor(Math.random() * 3);
    const overlap = Math.max(0, d.currentWidth - offset);
    if (overlap <= 0) {
      d.fallen = true;
    } else {
      d.currentWidth = overlap;
      d.blocks.push(overlap);
      d.score += overlap * 10;
    }
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<TowerState>();
    return d.fallen || d.blocks.length >= d.maxHeight;
  }

  protected determineWinner(): string | null {
    return this.getData<TowerState>().fallen ? null : this.getPlayers()[0];
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<TowerState>().score };
  }
}
