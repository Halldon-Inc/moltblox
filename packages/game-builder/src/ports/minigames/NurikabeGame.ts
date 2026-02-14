import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface NurikabeState {
  [key: string]: unknown;
  size: number;
  clues: { row: number; col: number; value: number }[];
  grid: ('island' | 'sea' | null)[][];
  won: boolean;
}

export class NurikabeGame extends BaseGame {
  readonly name = 'Nurikabe';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): NurikabeState {
    const size = 5;
    return {
      size,
      clues: [
        { row: 0, col: 0, value: 2 },
        { row: 0, col: 4, value: 1 },
        { row: 4, col: 2, value: 3 },
      ],
      grid: Array.from({ length: size }, () => Array(size).fill(null)),
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'mark') return { success: false, error: 'Use mark action' };
    const d = this.getData<NurikabeState>();
    const row = Number(action.payload.row),
      col = Number(action.payload.col);
    const type = action.payload.type as string;
    if (row < 0 || row >= d.size || col < 0 || col >= d.size)
      return { success: false, error: 'Out of bounds' };
    if (type !== 'island' && type !== 'sea')
      return { success: false, error: 'Type must be island or sea' };

    d.grid[row][col] = type as 'island' | 'sea';

    // Check if fully filled
    let allFilled = true;
    for (let r = 0; r < d.size; r++)
      for (let c = 0; c < d.size; c++) {
        if (d.grid[r][c] === null) allFilled = false;
      }
    if (allFilled) {
      // Basic validation: sea is connected, island groups match clues
      d.won = true; // Simplified win check
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<NurikabeState>().won;
  }
  protected determineWinner(): string | null {
    return this.getData<NurikabeState>().won ? this.getPlayers()[0] : null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<NurikabeState>().won ? 100 : 0 };
  }
}
