import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface ReversiState {
  [key: string]: unknown;
  board: (number | null)[][]; // null=empty, 0=p1, 1=p2
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
  consecutivePasses: number;
}

const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export class ReversiGame extends BaseGame {
  readonly name = 'Reversi';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ReversiState {
    const board: (number | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[3][3] = 1;
    board[3][4] = 0;
    board[4][3] = 0;
    board[4][4] = 1;
    return { board, currentPlayer: 0, winner: null, gameEnded: false, consecutivePasses: 0 };
  }

  private getFlips(
    board: (number | null)[][],
    row: number,
    col: number,
    player: number,
  ): [number, number][] {
    const flips: [number, number][] = [];
    const opp = 1 - player;
    for (const [dr, dc] of DIRS) {
      const line: [number, number][] = [];
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opp) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }
      if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
        flips.push(...line);
      }
    }
    return flips;
  }

  private hasValidMove(board: (number | null)[][], player: number): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === null && this.getFlips(board, r, c, player).length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ReversiState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const pIdx = data.currentPlayer;

    if (action.type === 'pass') {
      if (this.hasValidMove(data.board, pIdx)) {
        return { success: false, error: 'You have valid moves available' };
      }
      data.consecutivePasses++;
      data.currentPlayer = 1 - pIdx;
      if (data.consecutivePasses >= 2) {
        this.endGame(data, players);
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'place') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (row < 0 || row >= 8 || col < 0 || col >= 8) {
      return { success: false, error: 'Position out of bounds' };
    }
    if (data.board[row][col] !== null) {
      return { success: false, error: 'Cell is occupied' };
    }

    const flips = this.getFlips(data.board, row, col, pIdx);
    if (flips.length === 0) {
      return { success: false, error: 'Invalid move: no pieces flipped' };
    }

    data.board[row][col] = pIdx;
    for (const [fr, fc] of flips) {
      data.board[fr][fc] = pIdx;
    }

    data.consecutivePasses = 0;
    data.currentPlayer = 1 - pIdx;

    // If next player has no valid moves, auto-pass or end
    if (!this.hasValidMove(data.board, 1 - pIdx)) {
      if (!this.hasValidMove(data.board, pIdx)) {
        this.endGame(data, players);
      } else {
        data.currentPlayer = pIdx; // skip opponent
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private endGame(data: ReversiState, players: string[]): void {
    data.gameEnded = true;
    let count0 = 0;
    let count1 = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (data.board[r][c] === 0) count0++;
        else if (data.board[r][c] === 1) count1++;
      }
    }
    if (count0 > count1) data.winner = players[0];
    else if (count1 > count0) data.winner = players[1];
    else data.winner = null;
  }

  protected checkGameOver(): boolean {
    return this.getData<ReversiState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<ReversiState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ReversiState>();
    const players = this.getPlayers();
    let count0 = 0;
    let count1 = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (data.board[r][c] === 0) count0++;
        else if (data.board[r][c] === 1) count1++;
      }
    }
    return { [players[0]]: count0, [players[1]]: count1 };
  }
}
