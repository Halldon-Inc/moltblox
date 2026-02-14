import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

interface ChessPiece {
  type: PieceType;
  owner: string;
  moved: boolean;
}

interface ChessState {
  [key: string]: unknown;
  board: (ChessPiece | null)[][];
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class ChessGame extends BaseGame {
  readonly name = 'Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ChessState {
    const board: (ChessPiece | null)[][] = [];
    for (let r = 0; r < 8; r++) board.push(Array(8).fill(null));

    const backRow: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    // Player 1 (index 1) at top (row 0), Player 0 (index 0) at bottom (row 7)
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: backRow[c], owner: playerIds[1], moved: false };
      board[1][c] = { type: 'P', owner: playerIds[1], moved: false };
      board[6][c] = { type: 'P', owner: playerIds[0], moved: false };
      board[7][c] = { type: backRow[c], owner: playerIds[0], moved: false };
    }

    return {
      board,
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

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ChessState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);
    const promotion = action.payload.promotion as PieceType | undefined;

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId)
      return { success: false, error: 'No valid piece at source' };

    // Validate move
    if (!this.isLegalMove(data, fromR, fromC, toR, toC, playerId)) {
      return { success: false, error: 'Illegal move' };
    }

    // Execute move
    const capturedPiece = data.board[toR][toC];
    const wasPawn = piece.type === 'P';
    const isCapture = capturedPiece !== null;

    // En passant capture
    if (
      wasPawn &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      const epCaptureR = fromR;
      data.board[epCaptureR][toC] = null;
    }

    // Castling
    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        // King-side
        data.board[fromR][5] = data.board[fromR][7];
        data.board[fromR][7] = null;
        if (data.board[fromR][5]) data.board[fromR][5].moved = true;
      } else {
        // Queen-side
        data.board[fromR][3] = data.board[fromR][0];
        data.board[fromR][0] = null;
        if (data.board[fromR][3]) data.board[fromR][3].moved = true;
      }
    }

    // Update en passant target
    if (wasPawn && Math.abs(toR - fromR) === 2) {
      data.enPassantTarget = [(fromR + toR) / 2, fromC];
    } else {
      data.enPassantTarget = null;
    }

    // Move piece
    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;
    piece.moved = true;

    // Pawn promotion
    if (wasPawn && (toR === 0 || toR === 7)) {
      const validPromo: PieceType[] = ['Q', 'R', 'B', 'N'];
      piece.type = promotion && validPromo.includes(promotion) ? promotion : 'Q';
    }

    // Update castling rights
    if (piece.type === 'K') {
      data.castlingRights[data.currentPlayer].kingSide = false;
      data.castlingRights[data.currentPlayer].queenSide = false;
    }
    if (piece.type === 'R') {
      if (fromC === 0) data.castlingRights[data.currentPlayer].queenSide = false;
      if (fromC === 7) data.castlingRights[data.currentPlayer].kingSide = false;
    }

    // Half-move clock
    if (wasPawn || isCapture) data.halfMoveClock = 0;
    else data.halfMoveClock++;

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    const opponent = players[data.currentPlayer];

    // Check for checkmate/stalemate
    const inCheck = this.isKingInCheck(data, opponent);
    const hasLegalMoves = this.hasAnyLegalMove(data, opponent);

    if (!hasLegalMoves) {
      if (inCheck) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      } else {
        data.draw = true;
        this.emitEvent('stalemate', undefined, {});
      }
    } else if (inCheck) {
      this.emitEvent('check', opponent, {});
    }

    // 50-move rule
    if (data.halfMoveClock >= 100) {
      data.draw = true;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private isLegalMove(
    data: ChessState,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    player: string,
  ): boolean {
    if (toR < 0 || toR >= 8 || toC < 0 || toC >= 8) return false;
    if (fromR === toR && fromC === toC) return false;

    const piece = data.board[fromR][fromC]!;
    const target = data.board[toR][toC];
    if (target && target.owner === player) return false;

    if (!this.isPseudoLegalMove(data, piece, fromR, fromC, toR, toC, player)) return false;

    // Simulate move and check if king is left in check
    const saved = data.board[toR][toC];
    const savedEp = data.board[fromR]?.[toC];
    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;

    // En passant simulation
    let epCapture = false;
    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
      epCapture = true;
    }

    const inCheck = this.isKingInCheck(data, player);

    // Undo
    data.board[fromR][fromC] = piece;
    data.board[toR][toC] = saved;
    if (epCapture) data.board[fromR][toC] = savedEp;

    if (inCheck) return false;

    // Castling through check
    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (this.isKingInCheck(data, player)) return false;
      const midC = (fromC + toC) / 2;
      const savedMid = data.board[fromR][midC];
      data.board[fromR][midC] = piece;
      data.board[fromR][fromC] = null;
      const midCheck = this.isKingInCheck(data, player);
      data.board[fromR][fromC] = piece;
      data.board[fromR][midC] = savedMid;
      if (midCheck) return false;
    }

    return true;
  }

  private isPseudoLegalMove(
    data: ChessState,
    piece: ChessPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    player: string,
  ): boolean {
    const dr = toR - fromR;
    const dc = toC - fromC;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    const target = data.board[toR][toC];
    const players = this.getPlayers();
    const playerIdx = players.indexOf(player);

    switch (piece.type) {
      case 'P': {
        const forward = playerIdx === 0 ? -1 : 1;
        if (dc === 0 && dr === forward && !target) return true;
        if (
          dc === 0 &&
          dr === 2 * forward &&
          !piece.moved &&
          !target &&
          !data.board[fromR + forward][fromC]
        )
          return true;
        if (absDc === 1 && dr === forward) {
          if (target && target.owner !== player) return true;
          if (
            data.enPassantTarget &&
            toR === data.enPassantTarget[0] &&
            toC === data.enPassantTarget[1]
          )
            return true;
        }
        return false;
      }
      case 'N':
        return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
      case 'B':
        return absDr === absDc && this.isPathClear(data, fromR, fromC, toR, toC);
      case 'R':
        return (dr === 0 || dc === 0) && this.isPathClear(data, fromR, fromC, toR, toC);
      case 'Q':
        return (
          (absDr === absDc || dr === 0 || dc === 0) &&
          this.isPathClear(data, fromR, fromC, toR, toC)
        );
      case 'K': {
        if (absDr <= 1 && absDc <= 1) return true;
        // Castling
        if (absDr === 0 && absDc === 2 && !piece.moved) {
          const rights = data.castlingRights[playerIdx];
          if (dc === 2 && rights.kingSide) {
            const rook = data.board[fromR][7];
            return (
              !!rook &&
              rook.type === 'R' &&
              !rook.moved &&
              this.isPathClear(data, fromR, fromC, fromR, 7)
            );
          }
          if (dc === -2 && rights.queenSide) {
            const rook = data.board[fromR][0];
            return (
              !!rook &&
              rook.type === 'R' &&
              !rook.moved &&
              this.isPathClear(data, fromR, fromC, fromR, 0)
            );
          }
        }
        return false;
      }
    }
  }

  private isPathClear(
    data: ChessState,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
  ): boolean {
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let r = fromR + dr,
      c = fromC + dc;
    while (r !== toR || c !== toC) {
      if (data.board[r][c] !== null) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  private findKing(data: ChessState, player: string): [number, number] | null {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = data.board[r][c];
        if (p && p.type === 'K' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isKingInCheck(data: ChessState, player: string): boolean {
    const kingPos = this.findKing(data, player);
    if (!kingPos) return false;
    const [kr, kc] = kingPos;
    const opponent = this.getPlayers().find((p) => p !== player)!;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = data.board[r][c];
        if (piece && piece.owner === opponent) {
          if (this.isPseudoLegalMove(data, piece, r, c, kr, kc, opponent)) return true;
        }
      }
    }
    return false;
  }

  private hasAnyLegalMove(data: ChessState, player: string): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = data.board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (this.isLegalMove(data, r, c, tr, tc, player)) return true;
          }
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<ChessState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<ChessState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<ChessState>();
    const winner = data.winner;
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === winner ? 1 : 0;
    }
    return scores;
  }
}
