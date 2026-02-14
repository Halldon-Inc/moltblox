import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

interface DarkChessPiece {
  type: PieceType;
  owner: string;
}

interface DarkChessState {
  [key: string]: unknown;
  board: (DarkChessPiece | null)[][];
  currentPlayer: number;
  winner: string | null;
}

export class DarkChessGame extends BaseGame {
  readonly name = 'Dark Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): DarkChessState {
    const board: (DarkChessPiece | null)[][] = [];
    for (let r = 0; r < 8; r++) board.push(Array(8).fill(null));
    const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: back[c], owner: playerIds[1] };
      board[1][c] = { type: 'P', owner: playerIds[1] };
      board[6][c] = { type: 'P', owner: playerIds[0] };
      board[7][c] = { type: back[c], owner: playerIds[0] };
    }
    return { board, currentPlayer: 0, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DarkChessState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };
    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };
    if (toR < 0 || toR >= 8 || toC < 0 || toC >= 8)
      return { success: false, error: 'Out of bounds' };
    const target = data.board[toR][toC];
    if (target && target.owner === playerId)
      return { success: false, error: 'Cannot capture own piece' };

    // Simplified move validation
    if (!this.isValidMove(piece, fromR, fromC, toR, toC, data.board, data.currentPlayer)) {
      return { success: false, error: 'Invalid move for piece' };
    }

    // Check for king capture
    if (target && target.type === 'K') {
      data.winner = playerId;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;

    // Pawn promotion
    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      piece.type = 'Q';
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isValidMove(
    piece: DarkChessPiece,
    fr: number,
    fc: number,
    tr: number,
    tc: number,
    board: (DarkChessPiece | null)[][],
    pIdx: number,
  ): boolean {
    const dr = tr - fr,
      dc = tc - fc;
    const absDr = Math.abs(dr),
      absDc = Math.abs(dc);
    const forward = pIdx === 0 ? -1 : 1;

    switch (piece.type) {
      case 'P': {
        if (dc === 0 && dr === forward && !board[tr][tc]) return true;
        if (
          dc === 0 &&
          dr === 2 * forward &&
          !board[tr][tc] &&
          !board[fr + forward][fc] &&
          ((pIdx === 0 && fr === 6) || (pIdx === 1 && fr === 1))
        )
          return true;
        if (absDc === 1 && dr === forward && board[tr][tc]) return true;
        return false;
      }
      case 'N':
        return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      case 'B':
        return absDr === absDc && this.pathClear(board, fr, fc, tr, tc);
      case 'R':
        return (dr === 0 || dc === 0) && this.pathClear(board, fr, fc, tr, tc);
      case 'Q':
        return (absDr === absDc || dr === 0 || dc === 0) && this.pathClear(board, fr, fc, tr, tc);
      case 'K':
        return absDr <= 1 && absDc <= 1;
    }
  }

  private pathClear(
    board: (DarkChessPiece | null)[][],
    fr: number,
    fc: number,
    tr: number,
    tc: number,
  ): boolean {
    const dr = Math.sign(tr - fr),
      dc = Math.sign(tc - fc);
    let r = fr + dr,
      c = fc + dc;
    while (r !== tr || c !== tc) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  protected checkGameOver(): boolean {
    return this.getData<DarkChessState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<DarkChessState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const w = this.determineWinner();
    const s: Record<string, number> = {};
    for (const p of this.getPlayers()) s[p] = p === w ? 1 : 0;
    return s;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as DarkChessState;
    // Fog of war: only show cells visible to your pieces
    const visible = new Set<string>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (data.board[r][c]?.owner === playerId) {
          visible.add(`${r},${c}`);
          // Add all cells this piece can see
          for (let nr = 0; nr < 8; nr++) {
            for (let nc = 0; nc < 8; nc++) {
              if (Math.abs(nr - r) <= 2 && Math.abs(nc - c) <= 2) visible.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
    const maskedBoard = data.board.map((row, r) =>
      row.map((cell, c) => (visible.has(`${r},${c}`) ? cell : null)),
    );
    return { ...state, data: { ...data, board: maskedBoard } };
  }
}
