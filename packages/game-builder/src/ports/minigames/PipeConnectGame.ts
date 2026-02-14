import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type PipeType =
  | 'horizontal'
  | 'vertical'
  | 'corner_tl'
  | 'corner_tr'
  | 'corner_bl'
  | 'corner_br'
  | 'cross';

interface PipeState {
  [key: string]: unknown;
  width: number;
  height: number;
  grid: (PipeType | null)[][];
  source: number[];
  sink: number[];
  moves: number;
  maxMoves: number;
  won: boolean;
}

export class PipeConnectGame extends BaseGame {
  readonly name = 'Pipe Connect';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): PipeState {
    const w = 5,
      h = 5;
    return {
      width: w,
      height: h,
      grid: Array.from({ length: h }, () => Array(w).fill(null)),
      source: [0, 0],
      sink: [h - 1, w - 1],
      moves: 0,
      maxMoves: 20,
      won: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<PipeState>();
    if (action.type !== 'place') return { success: false, error: 'Use place action' };
    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    const pipeType = action.payload.pipeType as PipeType;
    if (row < 0 || row >= d.height || col < 0 || col >= d.width)
      return { success: false, error: 'Out of bounds' };
    const validTypes: PipeType[] = [
      'horizontal',
      'vertical',
      'corner_tl',
      'corner_tr',
      'corner_bl',
      'corner_br',
      'cross',
    ];
    if (!validTypes.includes(pipeType)) return { success: false, error: 'Invalid pipe type' };

    d.grid[row][col] = pipeType;
    d.moves++;

    if (this.checkConnected(d)) d.won = true;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  private checkConnected(d: PipeState): boolean {
    // Simplified: BFS from source to sink checking adjacent pipes exist
    const visited = new Set<string>();
    const queue = [`${d.source[0]},${d.source[1]}`];
    visited.add(queue[0]);
    while (queue.length > 0) {
      const [r, c] = queue.shift()!.split(',').map(Number);
      if (r === d.sink[0] && c === d.sink[1]) return true;
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nr = r + dr,
          nc = c + dc;
        const key = `${nr},${nc}`;
        if (
          nr >= 0 &&
          nr < d.height &&
          nc >= 0 &&
          nc < d.width &&
          !visited.has(key) &&
          d.grid[nr][nc] !== null
        ) {
          visited.add(key);
          queue.push(key);
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const d = this.getData<PipeState>();
    return d.won || d.moves >= d.maxMoves;
  }

  protected determineWinner(): string | null {
    return this.getData<PipeState>().won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<PipeState>();
    return { [this.getPlayers()[0]]: d.won ? Math.max(0, d.maxMoves - d.moves) * 10 : 0 };
  }
}
