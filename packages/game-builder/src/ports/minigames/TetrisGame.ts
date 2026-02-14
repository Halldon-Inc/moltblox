import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const PIECES = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
];

interface TetrisState {
  [key: string]: unknown;
  board: number[][];
  piece: number[][];
  pieceRow: number;
  pieceCol: number;
  score: number;
  gameOver: boolean;
  width: number;
  height: number;
}

export class TetrisGame extends BaseGame {
  readonly name = 'Tetris';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): TetrisState {
    const w = 10,
      h = 20;
    const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
    return {
      board: Array.from({ length: h }, () => Array(w).fill(0)),
      piece,
      pieceRow: 0,
      pieceCol: Math.floor((w - piece[0].length) / 2),
      score: 0,
      gameOver: false,
      width: w,
      height: h,
    };
  }

  private collides(d: TetrisState, pr: number, pc: number, piece: number[][]): boolean {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[0].length; c++) {
        if (!piece[r][c]) continue;
        const nr = pr + r,
          nc = pc + c;
        if (nr < 0 || nr >= d.height || nc < 0 || nc >= d.width) return true;
        if (d.board[nr][nc]) return true;
      }
    }
    return false;
  }

  private lock(d: TetrisState): void {
    for (let r = 0; r < d.piece.length; r++) {
      for (let c = 0; c < d.piece[0].length; c++) {
        if (d.piece[r][c]) d.board[d.pieceRow + r][d.pieceCol + c] = 1;
      }
    }
    let cleared = 0;
    d.board = d.board.filter((row) => {
      if (row.every((v) => v)) {
        cleared++;
        return false;
      }
      return true;
    });
    while (d.board.length < d.height) d.board.unshift(Array(d.width).fill(0));
    d.score += cleared * 100;

    const np = PIECES[Math.floor(Math.random() * PIECES.length)];
    d.piece = np;
    d.pieceRow = 0;
    d.pieceCol = Math.floor((d.width - np[0].length) / 2);
    if (this.collides(d, d.pieceRow, d.pieceCol, d.piece)) d.gameOver = true;
  }

  private rotate(piece: number[][]): number[][] {
    const rows = piece.length,
      cols = piece[0].length;
    const r: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) r[j][rows - 1 - i] = piece[i][j];
    return r;
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<TetrisState>();
    if (action.type === 'move') {
      const dir = action.payload.direction as string;
      let nr = d.pieceRow,
        nc = d.pieceCol;
      if (dir === 'left') nc--;
      else if (dir === 'right') nc++;
      else if (dir === 'down') nr++;
      else return { success: false, error: 'Invalid direction' };
      if (!this.collides(d, nr, nc, d.piece)) {
        d.pieceRow = nr;
        d.pieceCol = nc;
      } else if (dir === 'down') this.lock(d);
    } else if (action.type === 'rotate') {
      const rotated = this.rotate(d.piece);
      if (!this.collides(d, d.pieceRow, d.pieceCol, rotated)) d.piece = rotated;
    } else if (action.type === 'drop') {
      while (!this.collides(d, d.pieceRow + 1, d.pieceCol, d.piece)) d.pieceRow++;
      this.lock(d);
    } else {
      return { success: false, error: 'Unknown action' };
    }
    // Gravity: piece falls 1 after each action
    if (action.type !== 'drop') {
      if (!this.collides(d, d.pieceRow + 1, d.pieceCol, d.piece)) d.pieceRow++;
      else this.lock(d);
    }
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TetrisState>().gameOver;
  }
  protected determineWinner(): string | null {
    return null;
  }
  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<TetrisState>().score };
  }
}
