import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type PieceType,
  type Board,
  setupStandardBoard,
  isKingInCheck,
  isLegalMoveStandard,
  hasAnyLegalMove,
} from './chessHelpers.js';

/**
 * Grid Chess: 8x8 board with a 2x2 grid overlay.
 * Every move must cross at least one grid line.
 * Grid squares: (0,0)-(1,1), (0,2)-(1,3), etc.
 */
interface GridChessState {
  [key: string]: unknown;
  board: Board;
  currentPlayer: number;
  winner: string | null;
  draw: boolean;
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  castlingRights: { kingSide: boolean; queenSide: boolean }[];
}

export class GridChessGame extends BaseGame {
  readonly name = 'Grid Chess';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): GridChessState {
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

  private crossesGridLine(fromR: number, fromC: number, toR: number, toC: number): boolean {
    // Grid cells are 2x2. A grid line is crossed if the grid cell changes.
    const fromGridR = Math.floor(fromR / 2);
    const fromGridC = Math.floor(fromC / 2);
    const toGridR = Math.floor(toR / 2);
    const toGridC = Math.floor(toC / 2);
    return fromGridR !== toGridR || fromGridC !== toGridC;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GridChessState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const from = this.parseCoords(action.payload.from as string);
    const to = this.parseCoords(action.payload.to as string);
    if (!from || !to) return { success: false, error: 'Invalid coordinates' };
    const [fromR, fromC] = from;
    const [toR, toC] = to;

    // Must cross a grid line
    if (!this.crossesGridLine(fromR, fromC, toR, toC)) {
      return { success: false, error: 'Move must cross a grid line' };
    }

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };

    if (
      !isLegalMoveStandard(
        data.board,
        fromR,
        fromC,
        toR,
        toC,
        playerId,
        data.currentPlayer,
        players,
        data.enPassantTarget,
        data.castlingRights,
      )
    ) {
      return { success: false, error: 'Illegal move' };
    }

    const captured = data.board[toR][toC];

    if (
      piece.type === 'P' &&
      data.enPassantTarget &&
      toR === data.enPassantTarget[0] &&
      toC === data.enPassantTarget[1]
    ) {
      data.board[fromR][toC] = null;
    }

    if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
      if (toC > fromC) {
        data.board[fromR][5] = data.board[fromR][7];
        data.board[fromR][7] = null;
        if (data.board[fromR][5]) data.board[fromR][5]!.moved = true;
      } else {
        data.board[fromR][3] = data.board[fromR][0];
        data.board[fromR][0] = null;
        if (data.board[fromR][3]) data.board[fromR][3]!.moved = true;
      }
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
    const inCheck = isKingInCheck(data.board, opponent, players, data.enPassantTarget);

    // Check if opponent has any legal grid-crossing move
    let hasMoves = false;
    for (let r = 0; r < 8 && !hasMoves; r++) {
      for (let c = 0; c < 8 && !hasMoves; c++) {
        const p = data.board[r][c];
        if (!p || p.owner !== opponent) continue;
        for (let tr = 0; tr < 8 && !hasMoves; tr++) {
          for (let tc = 0; tc < 8 && !hasMoves; tc++) {
            if (!this.crossesGridLine(r, c, tr, tc)) continue;
            if (
              isLegalMoveStandard(
                data.board,
                r,
                c,
                tr,
                tc,
                opponent,
                data.currentPlayer,
                players,
                data.enPassantTarget,
                data.castlingRights,
              )
            ) {
              hasMoves = true;
            }
          }
        }
      }
    }

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
    const data = this.getData<GridChessState>();
    return data.winner !== null || data.draw;
  }

  protected determineWinner(): string | null {
    return this.getData<GridChessState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GridChessState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      if (data.draw) scores[p] = 0.5;
      else scores[p] = p === data.winner ? 1 : 0;
    }
    return scores;
  }
}
