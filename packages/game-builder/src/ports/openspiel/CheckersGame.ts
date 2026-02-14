import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface CheckersConfig {
  boardSize?: number;
  forcedCaptures?: boolean;
}

interface Piece {
  owner: string;
  king: boolean;
}

interface CheckersState {
  [key: string]: unknown;
  board: (Piece | null)[][];
  currentPlayer: number;
  size: number;
  winner: string | null;
  forcedCaptures: boolean;
}

export class CheckersGame extends BaseGame {
  readonly name = 'Checkers';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CheckersState {
    const cfg = this.config as CheckersConfig;
    const size = cfg.boardSize ?? 8;
    const board: (Piece | null)[][] = [];

    for (let r = 0; r < size; r++) {
      board.push(Array(size).fill(null));
    }

    const rowsPerPlayer = Math.floor((size - 2) / 2);
    for (let r = 0; r < rowsPerPlayer; r++) {
      for (let c = 0; c < size; c++) {
        if ((r + c) % 2 === 1) board[r][c] = { owner: playerIds[1], king: false };
      }
    }
    for (let r = size - rowsPerPlayer; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r + c) % 2 === 1) board[r][c] = { owner: playerIds[0], king: false };
      }
    }

    return {
      board,
      currentPlayer: 0,
      size,
      winner: null,
      forcedCaptures: cfg.forcedCaptures ?? true,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CheckersState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'move') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const fromRow = Number(action.payload.fromRow);
    const fromCol = Number(action.payload.fromCol);
    const toRow = Number(action.payload.toRow);
    const toCol = Number(action.payload.toCol);

    if ([fromRow, fromCol, toRow, toCol].some((v) => isNaN(v))) {
      return { success: false, error: 'Invalid coordinates' };
    }

    const piece = data.board[fromRow]?.[fromCol];
    if (!piece || piece.owner !== playerId) {
      return { success: false, error: 'No valid piece at source' };
    }

    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    // Direction check (non-kings can only move forward)
    const forward = players[data.currentPlayer] === players[0] ? -1 : 1;
    if (!piece.king && dr !== forward && absDr === 1) {
      return { success: false, error: 'Non-king pieces can only move forward' };
    }
    if (!piece.king && absDr === 2) {
      const captureDir = dr > 0 ? 1 : -1;
      if (captureDir !== forward && !data.forcedCaptures) {
        return { success: false, error: 'Non-king pieces can only capture forward' };
      }
    }

    if (absDr !== absDc || absDr < 1 || absDr > 2) {
      return { success: false, error: 'Invalid move distance' };
    }

    if (data.board[toRow]?.[toCol] !== null) {
      return { success: false, error: 'Destination occupied' };
    }

    // Check forced captures
    if (data.forcedCaptures && absDr === 1) {
      const captures = this.getAllCaptures(data, playerId);
      if (captures.length > 0) {
        return { success: false, error: 'Capture is mandatory' };
      }
    }

    let captured = false;
    if (absDr === 2) {
      const midRow = fromRow + dr / 2;
      const midCol = fromCol + dc / 2;
      const midPiece = data.board[midRow]?.[midCol];
      if (!midPiece || midPiece.owner === playerId) {
        return { success: false, error: 'No opponent piece to capture' };
      }
      data.board[midRow][midCol] = null;
      captured = true;
    }

    data.board[toRow][toCol] = piece;
    data.board[fromRow][fromCol] = null;

    // King promotion
    if (playerId === players[0] && toRow === 0) piece.king = true;
    if (playerId === players[1] && toRow === data.size - 1) piece.king = true;

    // Multi-jump: if captured and can capture again, don't switch turns
    if (captured) {
      const moreCaptures = this.getPieceCaptures(data, toRow, toCol, playerId, piece.king);
      if (moreCaptures.length > 0) {
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check if next player has moves
    const nextPlayer = players[data.currentPlayer];
    if (this.getAllMoves(data, nextPlayer).length === 0) {
      data.winner = playerId;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private getPieceCaptures(
    data: CheckersState,
    row: number,
    col: number,
    player: string,
    isKing: boolean,
  ): [number, number][] {
    const captures: [number, number][] = [];
    const players = this.getPlayers();
    const forward = player === players[0] ? -1 : 1;
    const dirs = isKing
      ? [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]
      : [
          [forward, -1],
          [forward, 1],
        ];

    for (const [dr, dc] of dirs) {
      const midR = row + dr,
        midC = col + dc;
      const toR = row + 2 * dr,
        toC = col + 2 * dc;
      if (toR >= 0 && toR < data.size && toC >= 0 && toC < data.size) {
        const mid = data.board[midR]?.[midC];
        if (mid && mid.owner !== player && data.board[toR][toC] === null) {
          captures.push([toR, toC]);
        }
      }
    }
    return captures;
  }

  private getAllCaptures(data: CheckersState, player: string): [number, number, number, number][] {
    const captures: [number, number, number, number][] = [];
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        const piece = data.board[r][c];
        if (piece && piece.owner === player) {
          for (const [tr, tc] of this.getPieceCaptures(data, r, c, player, piece.king)) {
            captures.push([r, c, tr, tc]);
          }
        }
      }
    }
    return captures;
  }

  private getAllMoves(data: CheckersState, player: string): [number, number, number, number][] {
    const moves: [number, number, number, number][] = [];
    const players = this.getPlayers();
    const forward = player === players[0] ? -1 : 1;

    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        const piece = data.board[r][c];
        if (!piece || piece.owner !== player) continue;

        const dirs = piece.king
          ? [
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
            ]
          : [
              [forward, -1],
              [forward, 1],
            ];
        for (const [dr, dc] of dirs) {
          const nr = r + dr,
            nc = c + dc;
          if (
            nr >= 0 &&
            nr < data.size &&
            nc >= 0 &&
            nc < data.size &&
            data.board[nr][nc] === null
          ) {
            moves.push([r, c, nr, nc]);
          }
        }
        for (const [tr, tc] of this.getPieceCaptures(data, r, c, player, piece.king)) {
          moves.push([r, c, tr, tc]);
        }
      }
    }
    return moves;
  }

  protected checkGameOver(): boolean {
    return this.getData<CheckersState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<CheckersState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CheckersState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      let count = 0;
      for (let r = 0; r < data.size; r++) {
        for (let c = 0; c < data.size; c++) {
          if (data.board[r][c]?.owner === p) count++;
        }
      }
      scores[p] = count;
    }
    return scores;
  }
}
