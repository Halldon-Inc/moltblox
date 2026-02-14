import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BreakthroughConfig {
  boardSize?: number;
}

interface BreakthroughState {
  [key: string]: unknown;
  board: (string | null)[][];
  currentPlayer: number;
  size: number;
  winner: string | null;
}

export class BreakthroughGame extends BaseGame {
  readonly name = 'Breakthrough';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): BreakthroughState {
    const size = (this.config as BreakthroughConfig).boardSize ?? 8;
    const board: (string | null)[][] = [];
    for (let r = 0; r < size; r++) board.push(Array(size).fill(null));
    // Player 0 starts at bottom (rows size-2, size-1), moves up
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < size; c++) board[r][c] = playerIds[1];
    }
    for (let r = size - 2; r < size; r++) {
      for (let c = 0; c < size; c++) board[r][c] = playerIds[0];
    }
    return { board, currentPlayer: 0, size, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BreakthroughState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const fromRow = Number(action.payload.fromRow);
    const fromCol = Number(action.payload.fromCol);
    const toRow = Number(action.payload.toRow);
    const toCol = Number(action.payload.toCol);

    if ([fromRow, fromCol, toRow, toCol].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };
    if (data.board[fromRow]?.[fromCol] !== playerId)
      return { success: false, error: 'No piece at source' };

    const forward = data.currentPlayer === 0 ? -1 : 1;
    const dr = toRow - fromRow;
    const dc = Math.abs(toCol - fromCol);

    if (dr !== forward || dc > 1) return { success: false, error: 'Invalid move' };
    if (toRow < 0 || toRow >= data.size || toCol < 0 || toCol >= data.size)
      return { success: false, error: 'Out of bounds' };

    // Can only capture diagonally
    if (dc === 0 && data.board[toRow][toCol] !== null)
      return { success: false, error: 'Cannot move straight into occupied cell' };
    if (dc === 1 && data.board[toRow][toCol] === playerId)
      return { success: false, error: 'Cannot capture own piece' };

    data.board[toRow][toCol] = playerId;
    data.board[fromRow][fromCol] = null;

    // Win: reach opposite end
    if (
      (data.currentPlayer === 0 && toRow === 0) ||
      (data.currentPlayer === 1 && toRow === data.size - 1)
    ) {
      data.winner = playerId;
    }

    // Win: eliminate all opponent pieces
    const opponent = players[(data.currentPlayer + 1) % 2];
    let opponentPieces = 0;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        if (data.board[r][c] === opponent) opponentPieces++;
      }
    }
    if (opponentPieces === 0) data.winner = playerId;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<BreakthroughState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<BreakthroughState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
