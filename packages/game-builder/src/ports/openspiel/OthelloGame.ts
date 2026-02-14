import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface OthelloConfig {
  boardSize?: number;
}

interface OthelloState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  size: number;
  passCount: number;
}

export class OthelloGame extends BaseGame {
  readonly name = 'Othello';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): OthelloState {
    const size = (this.config as OthelloConfig).boardSize ?? 8;
    const board: (string | null)[][] = [];
    for (let r = 0; r < size; r++) board.push(Array(size).fill(null));
    const mid = size / 2;
    board[mid - 1][mid - 1] = playerIds[1];
    board[mid][mid] = playerIds[1];
    board[mid - 1][mid] = playerIds[0];
    board[mid][mid - 1] = playerIds[0];
    return { board, currentPlayer: 0, size, passCount: 0 };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<OthelloState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'pass') {
      if (this.getValidMoves(data, playerId).length > 0) {
        return { success: false, error: 'You have valid moves and cannot pass' };
      }
      data.passCount++;
      data.currentPlayer = (data.currentPlayer + 1) % 2;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'place') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[row][col] !== null) {
      return { success: false, error: 'Cell occupied' };
    }

    const flips = this.getFlips(data, row, col, playerId);
    if (flips.length === 0) {
      return { success: false, error: 'Invalid move: no pieces to flip' };
    }

    data.board[row][col] = playerId;
    for (const [fr, fc] of flips) {
      data.board[fr][fc] = playerId;
    }
    data.passCount = 0;
    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getFlips(
    data: OthelloState,
    row: number,
    col: number,
    player: string,
  ): [number, number][] {
    const dirs = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    const opponent = this.getPlayers().find((p) => p !== player)!;
    const allFlips: [number, number][] = [];

    for (const [dr, dc] of dirs) {
      const flips: [number, number][] = [];
      let r = row + dr,
        c = col + dc;
      while (r >= 0 && r < data.size && c >= 0 && c < data.size && data.board[r][c] === opponent) {
        flips.push([r, c]);
        r += dr;
        c += dc;
      }
      if (
        flips.length > 0 &&
        r >= 0 &&
        r < data.size &&
        c >= 0 &&
        c < data.size &&
        data.board[r][c] === player
      ) {
        allFlips.push(...flips);
      }
    }
    return allFlips;
  }

  private getValidMoves(data: OthelloState, player: string): [number, number][] {
    const moves: [number, number][] = [];
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] === null && this.getFlips(data, r, c, player).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<OthelloState>();
    if (data.passCount >= 2) return true;
    // Board full
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] === null) return false;
      }
    }
    return true;
  }

  protected determineWinner(): string | null {
    const scores = this.calculateScores();
    const players = this.getPlayers();
    if (scores[players[0]] > scores[players[1]]) return players[0];
    if (scores[players[1]] > scores[players[0]]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<OthelloState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = 0;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] && scores[data.board[r][c]!] !== undefined) {
          scores[data.board[r][c]!]++;
        }
      }
    }
    return scores;
  }
}
