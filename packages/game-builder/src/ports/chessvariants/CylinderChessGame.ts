import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type ChessPiece,
  type Board,
  setupStandardBoard,
  findKing,
} from './chessHelpers.js';

/**
 * Cylinder Chess: a-file and h-file are adjacent. Board wraps horizontally.
 */
interface CylinderState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class CylinderChessGame extends BaseGame {
  readonly name = 'Cylinder Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CylinderState {
    return {
      board: setupStandardBoard(playerIds),
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
      halfMoveClock: 0,
      castlingRights: [
        { kingSide: true, queenSide: true },
        { kingSide: true, queenSide: true },
      ],
    };
  }

  private wrap(c: number): number {
    return ((c % 8) + 8) % 8;
  }

  private isPathClearCylinder(
    board: Board,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    const dr = Math.sign(toR - fromR);
    // For horizontal wrapping, we need to determine the direction
    let dc: number;
    if (fromC === toC) {
      dc = 0;
    } else {
      // Shortest path around cylinder
      const direct = toC - fromC;
      const wrapped = direct > 0 ? direct - 8 : direct + 8;
      dc = Math.abs(direct) <= Math.abs(wrapped) ? Math.sign(direct) : Math.sign(wrapped);
    }

    let r = fromR + dr;
    let c = this.wrap(fromC + dc);
    const steps = Math.max(Math.abs(toR - fromR), 1);
    let count = 0;
    while ((r !== toR || c !== toC) && count < 16) {
      if (board[r][c] !== null) return false;
      r += dr;
      c = this.wrap(c + dc);
      count++;
    }
    return true;
  }

  private isPseudoLegal(
    board: Board,
    piece: ChessPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    playerIdx: number,
    ep: [number, number] | null,
  ): boolean {
    if (toR < 0 || toR >= 8) return false;
    const tc = this.wrap(toC);
    if (fromR === toR && fromC === tc) return false;
    const target = board[toR][tc];
    if (target && target.owner === piece.owner) return false;

    const dr = toR - fromR;
    // Calculate cylindrical column distance
    const directDc = tc - fromC;
    const wrappedDc = directDc > 0 ? directDc - 8 : directDc + 8;
    const dc = Math.abs(directDc) <= Math.abs(wrappedDc) ? directDc : wrappedDc;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    switch (piece.type) {
      case 'P': {
        const forward = playerIdx === 0 ? -1 : 1;
        if (dc === 0 && dr === forward && !target) return true;
        if (
          dc === 0 &&
          dr === 2 * forward &&
          !piece.moved &&
          !target &&
          !board[fromR + forward][fromC]
        )
          return true;
        if (absDc === 1 && dr === forward) {
          if (target && target.owner !== piece.owner) return true;
          if (ep && toR === ep[0] && tc === ep[1]) return true;
        }
        return false;
      }
      case 'N':
        return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      case 'B':
        return absDr === absDc && this.isPathClearCylinder(board, fromR, fromC, toR, tc);
      case 'R':
        return (dr === 0 || dc === 0) && this.isPathClearCylinder(board, fromR, fromC, toR, tc);
      case 'Q':
        return (
          (absDr === absDc || dr === 0 || dc === 0) &&
          this.isPathClearCylinder(board, fromR, fromC, toR, tc)
        );
      case 'K':
        return absDr <= 1 && absDc <= 1;
    }
  }

  private isInCheck(
    board: Board,
    player: string,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    const king = findKing(board, player);
    if (!king) return false;
    const [kr, kc] = king;
    for (let i = 0; i < players.length; i++) {
      if (players[i] === player) continue;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.owner === players[i]) {
            if (this.isPseudoLegal(board, p, r, c, kr, kc, i, ep)) return true;
          }
        }
      }
    }
    return false;
  }

  private isLegal(
    board: Board,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    player: string,
    playerIdx: number,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    const piece = board[fromR][fromC];
    if (!piece || piece.owner !== player) return false;
    const tc = this.wrap(toC);
    if (!this.isPseudoLegal(board, piece, fromR, fromC, toR, tc, playerIdx, ep)) return false;

    const saved = board[toR][tc];
    board[toR][tc] = piece;
    board[fromR][fromC] = null;
    let epCapture = false;
    let savedEp: ChessPiece | null = null;
    if (piece.type === 'P' && ep && toR === ep[0] && tc === ep[1]) {
      savedEp = board[fromR][tc];
      board[fromR][tc] = null;
      epCapture = true;
    }
    const inCheck = this.isInCheck(board, player, players, ep);
    board[fromR][fromC] = piece;
    board[toR][tc] = saved;
    if (epCapture) board[fromR][tc] = savedEp;
    return !inCheck;
  }

  private hasAnyMove(
    board: Board,
    player: string,
    playerIdx: number,
    players: string[],
    ep: [number, number] | null,
  ): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (this.isLegal(board, r, c, tr, tc, player, playerIdx, players, ep)) return true;
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CylinderState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, rawToC] = to;
    const toC = this.wrap(rawToC);

    if (
      !this.isLegal(
        data.board,
        fromR,
        fromC,
        toR,
        toC,
        playerId,
        data.currentPlayer,
        players,
        data.enPassantTarget,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const piece = data.board[fromR][fromC]!;
    const captured = data.board[toR][toC];

    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
    }

    if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    if (piece.type === 'P' && (toR === 0 || toR === 7)) {
      const promotion = action.payload.promotion as PieceType | undefined;
      const valid: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer] = { kingSide: false, queenSide: false };
    }

    if (piece.type === 'P' || captured) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];
    const inCheck = this.isInCheck(data.board, opponent, players, data.enPassantTarget);
    const hasMoves = this.hasAnyMove(
      data.board,
      opponent,
      data.currentPlayer,
      players,
      data.enPassantTarget,
    );

    if (!hasMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
      }
    }
    if (data.halfMoveClock >= 100) data.draw = true;

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CylinderState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<CylinderState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CylinderState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
