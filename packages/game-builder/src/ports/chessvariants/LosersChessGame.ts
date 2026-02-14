import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type Board,
  setupStandardBoard,
  isPseudoLegalMove,
} from './chessHelpers.js';

interface LosersState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
}

export class LosersChessGame extends BaseGame {
  readonly name = 'Losers Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): LosersState {
    return {
      board: setupStandardBoard(playerIds),
      currentPlayer: 0,
      winner: null,
      draw: false,
      enPassantTarget: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LosersState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId)
      return { success: false, error: 'No valid piece at source' };

    if (
      !isPseudoLegalMove(
        data.board,
        piece,
        fromR,
        fromC,
        toR,
        toC,
        data.currentPlayer,
        data.enPassantTarget,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const isCapture =
      data.board[toR][toC] !== null ||
      (piece.type === 'P' &&
        data.enPassantTarget &&
        toR === data.enPassantTarget[0] &&
        toC === data.enPassantTarget[1]);

    // Must capture
    if (this.hasCapture(data, playerId) && !isCapture) {
      return { success: false, error: 'Must capture when possible' };
    }

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
      const valid: PieceType[] = ['Q', 'R', 'B', 'N', 'K'];
      piece.type = promotion && valid.includes(promotion) ? promotion : 'Q';
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Win by losing all pieces
    const myPieces = this.countPieces(data.board, playerId);
    if (myPieces === 0) {
      data.winner = playerId;
    }

    // Stalemate: lose all pieces wins, no moves = win for the player who can't move
    if (!data.winner) {
      const curPlayer = players[data.currentPlayer];
      if (!this.hasAnyMove(data, curPlayer)) {
        data.winner = curPlayer; // Stalemated player loses in losers chess? Actually wins.
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private hasCapture(data: LosersState, player: string): boolean {
    const idx = this.getPlayers().indexOf(player);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = data.board[r][c];
        if (!p || p.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (!isPseudoLegalMove(data.board, p, r, c, tr, tc, idx, data.enPassantTarget))
              continue;
            if (
              data.board[tr][tc] ||
              (p.type === 'P' &&
                data.enPassantTarget &&
                tr === data.enPassantTarget[0] &&
                tc === data.enPassantTarget[1])
            )
              return true;
          }
        }
      }
    }
    return false;
  }

  private hasAnyMove(data: LosersState, player: string): boolean {
    const idx = this.getPlayers().indexOf(player);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = data.board[r][c];
        if (!p || p.owner !== player) continue;
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (isPseudoLegalMove(data.board, p, r, c, tr, tc, idx, data.enPassantTarget))
              return true;
          }
        }
      }
    }
    return false;
  }

  private countPieces(board: Board, player: string): number {
    let count = 0;
    for (const row of board) for (const cell of row) if (cell?.owner === player) count++;
    return count;
  }

  private parseCoords(s: string): [number, number] | null {
    if (!s || s.length < 2) return null;
    const col = s.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(s.substring(1), 10);
    if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return [row, col];
  }

  protected checkGameOver(): boolean {
    const data = this.getData<LosersState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<LosersState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const w = this.getData<LosersState>().winner;
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === w ? 1 : 0;
    return scores;
  }
}
