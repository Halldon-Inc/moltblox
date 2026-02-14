import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface SudokuState {
  [key: string]: unknown;
  board: number[][];
  fixed: boolean[][];
  solution: number[][];
  mistakes: number;
  maxMistakes: number;
  completed: boolean;
}

export class SudokuGame extends BaseGame {
  readonly name = 'Sudoku';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private generatePuzzle(): { board: number[][]; solution: number[][] } {
    // Generate a valid solved board by filling diagonals first
    const solution: number[][] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    this.fillBoard(solution, 0, 0);

    const board = solution.map((r) => [...r]);
    // Remove cells to create puzzle (approximately 40 cells removed for medium difficulty)
    let removed = 0;
    const target = 40;
    while (removed < target) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (board[r][c] !== 0) {
        board[r][c] = 0;
        removed++;
      }
    }
    return { board, solution };
  }

  private fillBoard(board: number[][], row: number, col: number): boolean {
    if (row === 9) return true;
    const nextRow = col === 8 ? row + 1 : row;
    const nextCol = col === 8 ? 0 : col + 1;
    if (board[row][col] !== 0) return this.fillBoard(board, nextRow, nextCol);

    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    for (const num of nums) {
      if (this.isValid(board, row, col, num)) {
        board[row][col] = num;
        if (this.fillBoard(board, nextRow, nextCol)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  private isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (board[r][c] === num) return false;
      }
    }
    return true;
  }

  protected initializeState(playerIds: string[]): SudokuState {
    const { board, solution } = this.generatePuzzle();
    const fixed = board.map((r) => r.map((c) => c !== 0));
    return { board, fixed, solution, mistakes: 0, maxMistakes: 3, completed: false };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SudokuState>();

    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    const value = Number(action.payload.value);

    if (
      isNaN(row) ||
      isNaN(col) ||
      isNaN(value) ||
      row < 0 ||
      row >= 9 ||
      col < 0 ||
      col >= 9 ||
      value < 1 ||
      value > 9
    ) {
      return { success: false, error: 'Invalid input' };
    }
    if (data.fixed[row][col]) return { success: false, error: 'Cannot modify fixed cell' };

    if (value === data.solution[row][col]) {
      data.board[row][col] = value;
      // Check if complete
      let complete = true;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (data.board[r][c] !== data.solution[r][c]) {
            complete = false;
            break;
          }
        }
        if (!complete) break;
      }
      data.completed = complete;
    } else {
      data.mistakes++;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<SudokuState>();
    return data.completed || data.mistakes >= data.maxMistakes;
  }

  protected determineWinner(): string | null {
    return this.getData<SudokuState>().completed ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SudokuState>();
    const filledCells = data.board.flat().filter((v) => v !== 0).length;
    return { [this.getPlayers()[0]]: data.completed ? 100 - data.mistakes * 10 : filledCells };
  }
}
