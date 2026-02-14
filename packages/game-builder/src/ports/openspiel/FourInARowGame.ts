import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface FourInARowConfig {
  boardSize?: number;
  winLength?: number;
}

interface FourInARowState {
  [key: string]: unknown;
  board: (string | null)[];
  size: number;
  winLength: number;
  currentPlayer: number;
  winner: string | null;
}

/**
 * Four in a Row: Gravity-free placement on any open cell (unlike Connect Four).
 * Players take turns placing marks, first to get 4 in a row wins.
 */
export class FourInARowGame extends BaseGame {
  readonly name = 'Four in a Row';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(_playerIds: string[]): FourInARowState {
    const size = (this.config as FourInARowConfig).boardSize ?? 8;
    const winLength = (this.config as FourInARowConfig).winLength ?? 4;
    return {
      board: Array(size * size).fill(null),
      size,
      winLength,
      currentPlayer: 0,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<FourInARowState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);

    if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
      return { success: false, error: 'Invalid position' };
    }

    const idx = row * data.size + col;
    if (data.board[idx] !== null) return { success: false, error: 'Cell already occupied' };

    data.board[idx] = playerId;

    if (this.checkWin(data, row, col, playerId)) {
      data.winner = playerId;
      this.emitEvent('win', playerId, {});
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkWin(data: FourInARowState, row: number, col: number, player: string): boolean {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      for (let i = 1; i < data.winLength; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= data.size || c < 0 || c >= data.size) break;
        if (data.board[r * data.size + c] !== player) break;
        count++;
      }
      for (let i = 1; i < data.winLength; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r < 0 || r >= data.size || c < 0 || c >= data.size) break;
        if (data.board[r * data.size + c] !== player) break;
        count++;
      }
      if (count >= data.winLength) return true;
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<FourInARowState>();
    if (data.winner) return true;
    return data.board.every((cell) => cell !== null);
  }

  protected determineWinner(): string | null {
    return this.getData<FourInARowState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
