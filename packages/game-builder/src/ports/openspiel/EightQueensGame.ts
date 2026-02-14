import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface EightQueensConfig {
  boardSize?: number;
}

interface EightQueensState {
  [key: string]: unknown;
  board: boolean[][];
  queens: { row: number; col: number }[];
  boardSize: number;
  solved: boolean;
  failed: boolean;
}

export class EightQueensGame extends BaseGame {
  readonly name = 'Eight Queens';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): EightQueensState {
    const boardSize = (this.config as EightQueensConfig).boardSize ?? 8;
    const board: boolean[][] = [];
    for (let r = 0; r < boardSize; r++) {
      board.push(Array(boardSize).fill(false));
    }
    return { board, queens: [], boardSize, solved: false, failed: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<EightQueensState>();

    if (data.solved || data.failed) return { success: false, error: 'Game is over' };

    if (action.type === 'place') {
      const row = Number(action.payload.row);
      const col = Number(action.payload.col);

      if (
        isNaN(row) ||
        isNaN(col) ||
        row < 0 ||
        row >= data.boardSize ||
        col < 0 ||
        col >= data.boardSize
      ) {
        return { success: false, error: 'Invalid position' };
      }
      if (data.board[row][col]) return { success: false, error: 'Square already occupied' };
      if (!this.isSafe(data, row, col))
        return { success: false, error: 'Queen would be under attack' };

      data.board[row][col] = true;
      data.queens.push({ row, col });

      if (data.queens.length === data.boardSize) {
        data.solved = true;
        this.emitEvent('solved', playerId, { placements: data.queens.length });
      }
    } else if (action.type === 'remove') {
      const row = Number(action.payload.row);
      const col = Number(action.payload.col);

      if (
        isNaN(row) ||
        isNaN(col) ||
        row < 0 ||
        row >= data.boardSize ||
        col < 0 ||
        col >= data.boardSize
      ) {
        return { success: false, error: 'Invalid position' };
      }
      if (!data.board[row][col]) return { success: false, error: 'No queen at this position' };

      data.board[row][col] = false;
      data.queens = data.queens.filter((q) => q.row !== row || q.col !== col);
    } else if (action.type === 'give_up') {
      data.failed = true;
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isSafe(data: EightQueensState, row: number, col: number): boolean {
    for (const q of data.queens) {
      if (q.row === row || q.col === col) return false;
      if (Math.abs(q.row - row) === Math.abs(q.col - col)) return false;
    }
    return true;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<EightQueensState>();
    return data.solved || data.failed;
  }

  protected determineWinner(): string | null {
    return this.getData<EightQueensState>().solved ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<EightQueensState>();
    return { [this.getPlayers()[0]]: data.solved ? data.boardSize * 100 : 0 };
  }
}
