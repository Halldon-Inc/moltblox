import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface ClobberConfig {
  rows?: number;
  cols?: number;
}

interface ClobberState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  rows: number;
  cols: number;
  winner: string | null;
}

export class ClobberGame extends BaseGame {
  readonly name = 'Clobber';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ClobberState {
    const cfg = this.config as ClobberConfig;
    const rows = cfg.rows ?? 5;
    const cols = cfg.cols ?? 6;
    const board: (string | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < cols; c++) {
        row.push((r + c) % 2 === 0 ? playerIds[0] : playerIds[1]);
      }
      board.push(row);
    }
    return { board, currentPlayer: 0, rows, cols, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ClobberState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'clobber')
      return { success: false, error: `Unknown action: ${action.type}` };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };
    if (data.board[fromR]?.[fromC] !== playerId)
      return { success: false, error: 'No piece at source' };

    const dr = Math.abs(toR - fromR);
    const dc = Math.abs(toC - fromC);
    if (dr + dc !== 1) return { success: false, error: 'Must move to adjacent cell' };
    if (toR < 0 || toR >= data.rows || toC < 0 || toC >= data.cols)
      return { success: false, error: 'Out of bounds' };

    const target = data.board[toR][toC];
    if (target === null || target === playerId)
      return { success: false, error: 'Must capture an opponent piece' };

    data.board[toR][toC] = playerId;
    data.board[fromR][fromC] = null;

    // Check if opponent can move
    const opponent = players[(data.currentPlayer + 1) % 2];
    if (!this.canMove(data, opponent)) {
      data.winner = playerId;
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private canMove(data: ClobberState, player: string): boolean {
    const opponent = this.getPlayers().find((p) => p !== player)!;
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        if (data.board[r][c] !== player) continue;
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nr = r + dr,
            nc = c + dc;
          if (
            nr >= 0 &&
            nr < data.rows &&
            nc >= 0 &&
            nc < data.cols &&
            data.board[nr][nc] === opponent
          )
            return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<ClobberState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<ClobberState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
