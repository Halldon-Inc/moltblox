import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface LightOutState {
  [key: string]: unknown;
  grid: boolean[][];
  size: number;
  moves: number;
  won: boolean;
}

export class LightOutGame extends BaseGame {
  readonly name = 'Lights Out';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): LightOutState {
    const size = 5;
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.random() > 0.5),
    );
    return { grid, size, moves: 0, won: false };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'toggle') return { success: false, error: 'Use toggle action' };
    const d = this.getData<LightOutState>();
    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };

    const toggle = (r: number, c: number) => {
      if (r >= 0 && r < d.size && c >= 0 && c < d.size) d.grid[r][c] = !d.grid[r][c];
    };
    toggle(row, col);
    toggle(row - 1, col);
    toggle(row + 1, col);
    toggle(row, col - 1);
    toggle(row, col + 1);
    d.moves++;

    if (d.grid.every((row) => row.every((v) => !v))) d.won = true;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<LightOutState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<LightOutState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<LightOutState>();
    return { [this.getPlayers()[0]]: d.won ? Math.max(100 - d.moves * 5, 10) : 0 };
  }
}
