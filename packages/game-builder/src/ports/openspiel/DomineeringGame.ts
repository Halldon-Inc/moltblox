import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface DomineeringConfig {
  rows?: number;
  cols?: number;
}

interface DomineeringState {
  [key: string]: unknown;
  board: boolean[][];
  currentPlayer: number;
  rows: number;
  cols: number;
  winner: string | null;
}

export class DomineeringGame extends BaseGame {
  readonly name = 'Domineering';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): DomineeringState {
    const cfg = this.config as DomineeringConfig;
    const rows = cfg.rows ?? 8;
    const cols = cfg.cols ?? 8;
    const board: boolean[][] = [];
    for (let r = 0; r < rows; r++) board.push(Array(cols).fill(false));
    return { board, currentPlayer: 0, rows, cols, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DomineeringState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'place') return { success: false, error: `Unknown action: ${action.type}` };

    const row = Number(action.payload.row);
    const col = Number(action.payload.col);
    if (isNaN(row) || isNaN(col)) return { success: false, error: 'Invalid position' };

    // Player 0 places vertically, Player 1 places horizontally
    let r2 = row,
      c2 = col;
    if (data.currentPlayer === 0) r2 = row + 1;
    else c2 = col + 1;

    if (row < 0 || row >= data.rows || col < 0 || col >= data.cols)
      return { success: false, error: 'Out of bounds' };
    if (r2 >= data.rows || c2 >= data.cols)
      return { success: false, error: 'Domino goes out of bounds' };
    if (data.board[row][col] || data.board[r2][c2])
      return { success: false, error: 'Cell(s) occupied' };

    data.board[row][col] = true;
    data.board[r2][c2] = true;

    // Check if opponent can move
    const nextPlayer = (data.currentPlayer + 1) % 2;
    if (!this.canMove(data, nextPlayer)) {
      data.winner = playerId;
    }

    data.currentPlayer = nextPlayer;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private canMove(data: DomineeringState, playerIdx: number): boolean {
    if (playerIdx === 0) {
      // Vertical
      for (let r = 0; r < data.rows - 1; r++) {
        for (let c = 0; c < data.cols; c++) {
          if (!data.board[r][c] && !data.board[r + 1][c]) return true;
        }
      }
    } else {
      // Horizontal
      for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols - 1; c++) {
          if (!data.board[r][c] && !data.board[r][c + 1]) return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<DomineeringState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<DomineeringState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
