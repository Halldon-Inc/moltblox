import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface NineMensMorrisConfig {
  boardSize?: number;
}

/**
 * Board layout: 24 positions on 3 concentric squares connected by middle lines.
 * Adjacency list encodes the classic Nine Men's Morris board.
 */
const ADJACENCY: number[][] = [
  /* 0 */ [1, 9],
  /* 1 */ [0, 2, 4],
  /* 2 */ [1, 14],
  /* 3 */ [4, 10],
  /* 4 */ [1, 3, 5, 7],
  /* 5 */ [4, 13],
  /* 6 */ [7, 11],
  /* 7 */ [4, 6, 8],
  /* 8 */ [7, 12],
  /* 9 */ [0, 10, 21],
  /* 10 */ [3, 9, 11, 18],
  /* 11 */ [6, 10, 15],
  /* 12 */ [8, 13, 17],
  /* 13 */ [5, 12, 14, 20],
  /* 14 */ [2, 13, 23],
  /* 15 */ [11, 16],
  /* 16 */ [15, 17, 19],
  /* 17 */ [12, 16],
  /* 18 */ [10, 19],
  /* 19 */ [16, 18, 20, 22],
  /* 20 */ [13, 19],
  /* 21 */ [9, 22],
  /* 22 */ [19, 21, 23],
  /* 23 */ [14, 22],
];

const MILLS: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [15, 16, 17],
  [18, 19, 20],
  [21, 22, 23],
  [0, 9, 21],
  [3, 10, 18],
  [6, 11, 15],
  [1, 4, 7],
  [16, 19, 22],
  [8, 12, 17],
  [5, 13, 20],
  [2, 14, 23],
  [9, 10, 11],
  [12, 13, 14],
];

interface NineMensMorrisState {
  [key: string]: unknown;
  board: (string | null)[];
  currentPlayer: number;
  phase: string; // 'place' | 'move' | 'fly' per player tracked separately
  piecesPlaced: number[];
  piecesOnBoard: number[];
  pendingRemoval: boolean;
  winner: string | null;
}

export class NineMensMorrisGame extends BaseGame {
  readonly name = 'Nine Mens Morris';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(_playerIds: string[]): NineMensMorrisState {
    return {
      board: Array(24).fill(null),
      currentPlayer: 0,
      phase: 'place',
      piecesPlaced: [0, 0],
      piecesOnBoard: [0, 0],
      pendingRemoval: false,
      winner: null,
    };
  }

  private getPlayerPhase(data: NineMensMorrisState, playerIdx: number): string {
    if (data.piecesPlaced[playerIdx] < 9) return 'place';
    if (data.piecesOnBoard[playerIdx] <= 3) return 'fly';
    return 'move';
  }

  private formsMillAt(board: (string | null)[], pos: number, playerId: string): boolean {
    for (const mill of MILLS) {
      if (!mill.includes(pos)) continue;
      if (mill.every((p) => board[p] === playerId)) return true;
    }
    return false;
  }

  private allInMill(board: (string | null)[], playerId: string): boolean {
    for (let i = 0; i < 24; i++) {
      if (board[i] === playerId && !this.formsMillAt(board, i, playerId)) return false;
    }
    return true;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<NineMensMorrisState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    // Handle removal after forming a mill
    if (data.pendingRemoval) {
      if (action.type !== 'remove') {
        return { success: false, error: 'Must remove an opponent piece (action: remove)' };
      }
      const pos = Number(action.payload.position);
      if (isNaN(pos) || pos < 0 || pos >= 24) {
        return { success: false, error: 'Invalid position' };
      }
      const opponentId = players[1 - pIdx];
      if (data.board[pos] !== opponentId) {
        return { success: false, error: 'Must remove an opponent piece' };
      }
      if (
        this.formsMillAt(data.board, pos, opponentId) &&
        !this.allInMill(data.board, opponentId)
      ) {
        return {
          success: false,
          error: 'Cannot remove a piece in a mill unless all opponent pieces are in mills',
        };
      }
      data.board[pos] = null;
      data.piecesOnBoard[1 - pIdx]--;
      data.pendingRemoval = false;

      // Check if opponent lost (fewer than 3 pieces after placement phase)
      if (data.piecesPlaced[1 - pIdx] >= 9 && data.piecesOnBoard[1 - pIdx] < 3) {
        data.winner = playerId;
      }

      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const playerPhase = this.getPlayerPhase(data, pIdx);

    if (playerPhase === 'place') {
      if (action.type !== 'place') {
        return { success: false, error: 'Must place a piece (action: place)' };
      }
      const pos = Number(action.payload.position);
      if (isNaN(pos) || pos < 0 || pos >= 24) {
        return { success: false, error: 'Invalid position' };
      }
      if (data.board[pos] !== null) {
        return { success: false, error: 'Position already occupied' };
      }
      data.board[pos] = playerId;
      data.piecesPlaced[pIdx]++;
      data.piecesOnBoard[pIdx]++;

      if (this.formsMillAt(data.board, pos, playerId)) {
        data.pendingRemoval = true;
        this.emitEvent('mill', playerId, { position: pos });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Move or Fly phase
    if (action.type !== 'move') {
      return { success: false, error: 'Must move a piece (action: move)' };
    }
    const from = Number(action.payload.from);
    const to = Number(action.payload.to);
    if (isNaN(from) || isNaN(to) || from < 0 || from >= 24 || to < 0 || to >= 24) {
      return { success: false, error: 'Invalid position' };
    }
    if (data.board[from] !== playerId) {
      return { success: false, error: 'No piece at source position' };
    }
    if (data.board[to] !== null) {
      return { success: false, error: 'Destination occupied' };
    }
    if (playerPhase === 'move' && !ADJACENCY[from].includes(to)) {
      return { success: false, error: 'Can only move to adjacent positions' };
    }

    data.board[from] = null;
    data.board[to] = playerId;

    if (this.formsMillAt(data.board, to, playerId)) {
      data.pendingRemoval = true;
      this.emitEvent('mill', playerId, { from, to });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    data.currentPlayer = 1 - pIdx;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<NineMensMorrisState>();
    return data.winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<NineMensMorrisState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
