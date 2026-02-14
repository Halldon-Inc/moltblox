import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TicTacToeConfig {
  boardSize?: number;
}

interface TicTacToeState {
  [key: string]: unknown;
  board: (string | null)[];
  currentPlayer: number;
  winner: string | null;
}

export class TicTacToeGame extends BaseGame {
  readonly name = 'Tic Tac Toe';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): TicTacToeState {
    const size = (this.config as TicTacToeConfig).boardSize ?? 3;
    return {
      board: Array(size * size).fill(null),
      currentPlayer: 0,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TicTacToeState>();
    const players = this.getPlayers();
    const size = Math.sqrt(data.board.length);

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type !== 'place') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const index = Number(action.payload.index ?? action.payload.position);
    if (isNaN(index) || index < 0 || index >= data.board.length) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[index] !== null) {
      return { success: false, error: 'Cell already occupied' };
    }

    data.board[index] = playerId;

    // Check win
    if (this.checkWin(data.board, playerId, size)) {
      data.winner = playerId;
      this.emitEvent('win', playerId, { board: [...data.board] });
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkWin(board: (string | null)[], player: string, size: number): boolean {
    // Rows
    for (let r = 0; r < size; r++) {
      let win = true;
      for (let c = 0; c < size; c++) {
        if (board[r * size + c] !== player) {
          win = false;
          break;
        }
      }
      if (win) return true;
    }
    // Columns
    for (let c = 0; c < size; c++) {
      let win = true;
      for (let r = 0; r < size; r++) {
        if (board[r * size + c] !== player) {
          win = false;
          break;
        }
      }
      if (win) return true;
    }
    // Diagonals
    let win = true;
    for (let i = 0; i < size; i++) {
      if (board[i * size + i] !== player) {
        win = false;
        break;
      }
    }
    if (win) return true;
    win = true;
    for (let i = 0; i < size; i++) {
      if (board[i * size + (size - 1 - i)] !== player) {
        win = false;
        break;
      }
    }
    return win;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TicTacToeState>();
    if (data.winner) return true;
    return data.board.every((cell) => cell !== null);
  }

  protected determineWinner(): string | null {
    return this.getData<TicTacToeState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = p === winner ? 1 : 0;
    }
    return scores;
  }
}
