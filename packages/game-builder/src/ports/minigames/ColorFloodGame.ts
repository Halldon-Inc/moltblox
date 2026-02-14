import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface ColorFloodState {
  [key: string]: unknown;
  grid: number[][];
  size: number;
  numColors: number;
  moves: number;
  maxMoves: number;
  won: boolean;
}

export class ColorFloodGame extends BaseGame {
  readonly name = 'Color Flood';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): ColorFloodState {
    const size = (this.config.size as number) ?? 8;
    const numColors = 6;
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.floor(Math.random() * numColors)),
    );
    return { grid, size, numColors, moves: 0, maxMoves: 25, won: false };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'flood') return { success: false, error: 'Use flood action' };
    const d = this.getData<ColorFloodState>();
    const color = Number(action.payload.color);
    if (color < 0 || color >= d.numColors) return { success: false, error: 'Invalid color' };

    const oldColor = d.grid[0][0];
    if (color === oldColor) return { success: false, error: 'Same color as current' };

    // Flood fill from top-left
    const visited = new Set<string>();
    const queue = ['0,0'];
    visited.add('0,0');
    while (queue.length > 0) {
      const [r, c] = queue.shift()!.split(',').map(Number);
      if (d.grid[r][c] !== oldColor) continue;
      d.grid[r][c] = color;
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nr = r + dr,
          nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < d.size && nc >= 0 && nc < d.size && !visited.has(key)) {
          visited.add(key);
          if (d.grid[nr][nc] === oldColor) queue.push(key);
        }
      }
    }

    d.moves++;
    if (d.grid.every((row) => row.every((c) => c === color))) d.won = true;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<ColorFloodState>();
    return d.won || d.moves >= d.maxMoves;
  }

  protected determineWinner(): string | null {
    return this.getData<ColorFloodState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<ColorFloodState>();
    return { [this.getPlayers()[0]]: d.won ? (d.maxMoves - d.moves) * 10 : 0 };
  }
}
