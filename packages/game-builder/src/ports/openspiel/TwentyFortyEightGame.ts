import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TwentyFortyEightConfig {
  size?: number;
  target?: number;
}

interface TwentyFortyEightState {
  [key: string]: unknown;
  board: number[][];
  score: number;
  size: number;
  target: number;
  gameOver: boolean;
  won: boolean;
}

export class TwentyFortyEightGame extends BaseGame {
  readonly name = '2048';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(playerIds: string[]): TwentyFortyEightState {
    const cfg = this.config as TwentyFortyEightConfig;
    const size = cfg.size ?? 4;
    const board: number[][] = [];
    for (let r = 0; r < size; r++) board.push(Array(size).fill(0));
    this.addRandomTile(board, size);
    this.addRandomTile(board, size);
    return { board, score: 0, size, target: cfg.target ?? 2048, gameOver: false, won: false };
  }

  private addRandomTile(board: number[][], size: number): void {
    const empty: [number, number][] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TwentyFortyEightState>();

    if (action.type !== 'slide') return { success: false, error: `Unknown action: ${action.type}` };

    const direction = String(action.payload.direction);
    if (!['up', 'down', 'left', 'right'].includes(direction)) {
      return { success: false, error: 'Direction must be up, down, left, or right' };
    }

    const oldBoard = data.board.map((r) => [...r]);
    let scored = 0;

    const slide = (line: number[]): [number[], number] => {
      let s = 0;
      const filtered = line.filter((v) => v !== 0);
      const result: number[] = [];
      let i = 0;
      while (i < filtered.length) {
        if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
          const merged = filtered[i] * 2;
          result.push(merged);
          s += merged;
          i += 2;
        } else {
          result.push(filtered[i]);
          i++;
        }
      }
      while (result.length < data.size) result.push(0);
      return [result, s];
    };

    for (let i = 0; i < data.size; i++) {
      let line: number[];
      if (direction === 'left') line = data.board[i].slice();
      else if (direction === 'right') line = data.board[i].slice().reverse();
      else if (direction === 'up') line = data.board.map((r) => r[i]);
      else line = data.board.map((r) => r[i]).reverse();

      const [result, s] = slide(line);
      scored += s;

      if (direction === 'left') data.board[i] = result;
      else if (direction === 'right') data.board[i] = result.reverse();
      else if (direction === 'up') for (let r = 0; r < data.size; r++) data.board[r][i] = result[r];
      else for (let r = 0; r < data.size; r++) data.board[r][i] = result[data.size - 1 - r];
    }

    // Check if board changed
    let changed = false;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] !== oldBoard[r][c]) {
          changed = true;
          break;
        }
      }
      if (changed) break;
    }

    if (!changed) return { success: false, error: 'No tiles moved' };

    data.score += scored;
    this.addRandomTile(data.board, data.size);

    // Check win
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] >= data.target) data.won = true;
      }
    }

    // Check game over
    let hasEmpty = false;
    let canMerge = false;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] === 0) hasEmpty = true;
        if (c + 1 < data.size && data.board[r][c] === data.board[r][c + 1]) canMerge = true;
        if (r + 1 < data.size && data.board[r][c] === data.board[r + 1][c]) canMerge = true;
      }
    }
    if (!hasEmpty && !canMerge) data.gameOver = true;

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TwentyFortyEightState>();
    return data.gameOver || data.won;
  }

  protected determineWinner(): string | null {
    const data = this.getData<TwentyFortyEightState>();
    return data.won ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<TwentyFortyEightState>().score };
  }
}
