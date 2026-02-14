import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type ShogiPieceType =
  | 'K'
  | 'R'
  | 'B'
  | 'G'
  | 'S'
  | 'N'
  | 'L'
  | 'P'
  | '+R'
  | '+B'
  | '+S'
  | '+N'
  | '+L'
  | '+P';

interface ShogiPiece {
  type: ShogiPieceType;
  owner: string;
}

type ShogiBoard = (ShogiPiece | null)[][];

interface ShogiState {
  [key: string]: unknown;
  board: ShogiBoard;
  currentPlayer: number;
  winner: string | null;
  reserves: Record<string, ShogiPieceType[]>;
}

const PROMOTIONS: Record<string, ShogiPieceType> = {
  R: '+R',
  B: '+B',
  S: '+S',
  N: '+N',
  L: '+L',
  P: '+P',
};
const DEMOTIONS: Record<string, ShogiPieceType> = {
  '+R': 'R',
  '+B': 'B',
  '+S': 'S',
  '+N': 'N',
  '+L': 'L',
  '+P': 'P',
};

export class ShogiGame extends BaseGame {
  readonly name = 'Shogi';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): ShogiState {
    const board: ShogiBoard = [];
    for (let r = 0; r < 9; r++) board.push(Array(9).fill(null));
    const p0 = playerIds[0]; // Sente (bottom, moves up)
    const p1 = playerIds[1]; // Gote (top, moves down)

    // Gote back rank (row 0)
    board[0][0] = { type: 'L', owner: p1 };
    board[0][1] = { type: 'N', owner: p1 };
    board[0][2] = { type: 'S', owner: p1 };
    board[0][3] = { type: 'G', owner: p1 };
    board[0][4] = { type: 'K', owner: p1 };
    board[0][5] = { type: 'G', owner: p1 };
    board[0][6] = { type: 'S', owner: p1 };
    board[0][7] = { type: 'N', owner: p1 };
    board[0][8] = { type: 'L', owner: p1 };
    board[1][1] = { type: 'R', owner: p1 };
    board[1][7] = { type: 'B', owner: p1 };
    for (let c = 0; c < 9; c++) board[2][c] = { type: 'P', owner: p1 };

    // Sente back rank (row 8)
    board[8][0] = { type: 'L', owner: p0 };
    board[8][1] = { type: 'N', owner: p0 };
    board[8][2] = { type: 'S', owner: p0 };
    board[8][3] = { type: 'G', owner: p0 };
    board[8][4] = { type: 'K', owner: p0 };
    board[8][5] = { type: 'G', owner: p0 };
    board[8][6] = { type: 'S', owner: p0 };
    board[8][7] = { type: 'N', owner: p0 };
    board[8][8] = { type: 'L', owner: p0 };
    board[7][7] = { type: 'R', owner: p0 };
    board[7][1] = { type: 'B', owner: p0 };
    for (let c = 0; c < 9; c++) board[6][c] = { type: 'P', owner: p0 };

    const reserves: Record<string, ShogiPieceType[]> = {};
    reserves[p0] = [];
    reserves[p1] = [];

    return { board, currentPlayer: 0, winner: null, reserves };
  }

  private getMoveDeltas(type: ShogiPieceType, playerIdx: number): [number, number][] {
    const fwd = playerIdx === 0 ? -1 : 1;
    switch (type) {
      case 'K':
        return [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ];
      case 'G':
        return [
          [fwd, -1],
          [fwd, 0],
          [fwd, 1],
          [0, -1],
          [0, 1],
          [-fwd, 0],
        ];
      case 'S':
        return [
          [fwd, -1],
          [fwd, 0],
          [fwd, 1],
          [-fwd, -1],
          [-fwd, 1],
        ];
      case 'N':
        return [
          [2 * fwd, -1],
          [2 * fwd, 1],
        ];
      case 'P':
        return [[fwd, 0]];
      case '+S':
      case '+N':
      case '+L':
      case '+P':
        return this.getMoveDeltas('G', playerIdx);
      default:
        return [];
    }
  }

  private isSlidingPiece(type: ShogiPieceType): boolean {
    return ['R', 'B', 'L', '+R', '+B'].includes(type);
  }

  private getSlideDirections(type: ShogiPieceType, playerIdx: number): [number, number][] {
    const fwd = playerIdx === 0 ? -1 : 1;
    switch (type) {
      case 'R':
        return [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
      case 'B':
        return [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ];
      case 'L':
        return [[fwd, 0]];
      case '+R':
        return [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]; // + king step diagonals handled below
      case '+B':
        return [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]; // + king step orthogonals handled below
      default:
        return [];
    }
  }

  private canMove(
    board: ShogiBoard,
    piece: ShogiPiece,
    fromR: number,
    fromC: number,
    toR: number,
    toC: number,
    playerIdx: number,
  ): boolean {
    if (toR < 0 || toR >= 9 || toC < 0 || toC >= 9) return false;
    if (fromR === toR && fromC === toC) return false;
    const target = board[toR][toC];
    if (target && target.owner === piece.owner) return false;

    // Step moves
    const deltas = this.getMoveDeltas(piece.type, playerIdx);
    for (const [dr, dc] of deltas) {
      if (fromR + dr === toR && fromC + dc === toC) return true;
    }

    // Promoted rook/bishop get extra king steps
    if (piece.type === '+R') {
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        if (fromR + dr === toR && fromC + dc === toC) return true;
      }
    }
    if (piece.type === '+B') {
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        if (fromR + dr === toR && fromC + dc === toC) return true;
      }
    }

    // Sliding moves
    if (this.isSlidingPiece(piece.type)) {
      for (const [dr, dc] of this.getSlideDirections(piece.type, playerIdx)) {
        let r = fromR + dr,
          c = fromC + dc;
        while (r >= 0 && r < 9 && c >= 0 && c < 9) {
          if (r === toR && c === toC) return true;
          if (board[r][c]) break;
          r += dr;
          c += dc;
        }
      }
    }

    return false;
  }

  private findKing(board: ShogiBoard, player: string): [number, number] | null {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.type === 'K' && p.owner === player) return [r, c];
      }
    }
    return null;
  }

  private isInCheck(board: ShogiBoard, player: string, players: string[]): boolean {
    const king = this.findKing(board, player);
    if (!king) return true; // No king = in check (lost)
    const [kr, kc] = king;
    for (let i = 0; i < players.length; i++) {
      if (players[i] === player) continue;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (p && p.owner === players[i]) {
            if (this.canMove(board, p, r, c, kr, kc, i)) return true;
          }
        }
      }
    }
    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ShogiState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'drop') {
      return this.handleDrop(data, playerId, action, players);
    }

    if (action.type !== 'move') return { success: false, error: `Unknown action: ${action.type}` };

    const fromR = Number(action.payload.fromRow);
    const fromC = Number(action.payload.fromCol);
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);
    const promote = action.payload.promote === true;

    if ([fromR, fromC, toR, toC].some((v) => isNaN(v)))
      return { success: false, error: 'Invalid coordinates' };

    const piece = data.board[fromR]?.[fromC];
    if (!piece || piece.owner !== playerId) return { success: false, error: 'No valid piece' };

    if (!this.canMove(data.board, piece, fromR, fromC, toR, toC, data.currentPlayer)) {
      return { success: false, error: 'Illegal move' };
    }

    // Check legality (not leaving king in check)
    const captured = data.board[toR][toC];
    data.board[toR][toC] = piece;
    data.board[fromR][fromC] = null;

    if (this.isInCheck(data.board, playerId, players)) {
      data.board[fromR][fromC] = piece;
      data.board[toR][toC] = captured;
      return { success: false, error: 'Move leaves king in check' };
    }

    // Capture: add to reserves (demoted)
    if (captured) {
      const baseType = DEMOTIONS[captured.type] || captured.type;
      if (baseType !== 'K') {
        data.reserves[playerId].push(baseType as ShogiPieceType);
      }
    }

    // Promotion: last 3 ranks
    const promoZoneStart = data.currentPlayer === 0 ? 0 : 6;
    const promoZoneEnd = data.currentPlayer === 0 ? 2 : 8;
    const inPromoZone =
      (toR >= promoZoneStart && toR <= promoZoneEnd) ||
      (fromR >= promoZoneStart && fromR <= promoZoneEnd);

    if (promote && inPromoZone && PROMOTIONS[piece.type]) {
      piece.type = PROMOTIONS[piece.type];
    }

    // Forced promotion: pawns/lances on last rank, knights on last 2 ranks
    const lastRank = data.currentPlayer === 0 ? 0 : 8;
    const secondLast = data.currentPlayer === 0 ? 1 : 7;
    if (piece.type === 'P' && toR === lastRank) piece.type = '+P';
    if (piece.type === 'L' && toR === lastRank) piece.type = '+L';
    if (piece.type === 'N' && (toR === lastRank || toR === secondLast)) piece.type = '+N';

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    // Check for checkmate
    const opponent = players[data.currentPlayer];
    if (this.isInCheck(data.board, opponent, players)) {
      if (!this.hasAnyLegalMove(data, opponent, data.currentPlayer, players)) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleDrop(
    data: ShogiState,
    playerId: string,
    action: GameAction,
    players: string[],
  ): ActionResult {
    const pieceType = action.payload.piece as ShogiPieceType;
    const toR = Number(action.payload.toRow);
    const toC = Number(action.payload.toCol);

    if (isNaN(toR) || isNaN(toC) || toR < 0 || toR >= 9 || toC < 0 || toC >= 9) {
      return { success: false, error: 'Invalid coordinates' };
    }
    if (data.board[toR][toC] !== null) return { success: false, error: 'Square occupied' };

    const idx = data.reserves[playerId].indexOf(pieceType);
    if (idx === -1) return { success: false, error: 'Piece not in reserve' };

    // Pawns cannot be dropped on last rank
    const lastRank = data.currentPlayer === 0 ? 0 : 8;
    if (pieceType === 'P' && toR === lastRank)
      return { success: false, error: 'Cannot drop pawn on last rank' };

    // Two pawns rule: no two unpromoted pawns in same column
    if (pieceType === 'P') {
      for (let r = 0; r < 9; r++) {
        const p = data.board[r][toC];
        if (p && p.type === 'P' && p.owner === playerId) {
          return { success: false, error: 'Two pawns in column' };
        }
      }
    }

    data.reserves[playerId].splice(idx, 1);
    data.board[toR][toC] = { type: pieceType, owner: playerId };

    // Drop cannot leave own king in check
    if (this.isInCheck(data.board, playerId, players)) {
      data.board[toR][toC] = null;
      data.reserves[playerId].splice(idx, 0, pieceType);
      return { success: false, error: 'Drop leaves king in check' };
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    const opponent = players[data.currentPlayer];
    if (this.isInCheck(data.board, opponent, players)) {
      // Pawn drop checkmate is illegal in shogi
      if (pieceType === 'P') {
        if (!this.hasAnyLegalMove(data, opponent, data.currentPlayer, players)) {
          data.board[toR][toC] = null;
          data.reserves[playerId].splice(idx, 0, pieceType);
          data.currentPlayer = (data.currentPlayer + 1) % 2;
          return { success: false, error: 'Pawn drop checkmate is illegal' };
        }
      }
      if (!this.hasAnyLegalMove(data, opponent, data.currentPlayer, players)) {
        data.winner = playerId;
        this.emitEvent('checkmate', playerId, {});
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private hasAnyLegalMove(
    data: ShogiState,
    player: string,
    playerIdx: number,
    players: string[],
  ): boolean {
    // Board moves
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = data.board[r][c];
        if (!piece || piece.owner !== player) continue;
        for (let tr = 0; tr < 9; tr++) {
          for (let tc = 0; tc < 9; tc++) {
            if (!this.canMove(data.board, piece, r, c, tr, tc, playerIdx)) continue;
            const saved = data.board[tr][tc];
            data.board[tr][tc] = piece;
            data.board[r][c] = null;
            const inCheck = this.isInCheck(data.board, player, players);
            data.board[r][c] = piece;
            data.board[tr][tc] = saved;
            if (!inCheck) return true;
          }
        }
      }
    }
    // Drop moves
    for (const pt of data.reserves[player]) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (data.board[r][c]) continue;
          data.board[r][c] = { type: pt, owner: player };
          const inCheck = this.isInCheck(data.board, player, players);
          data.board[r][c] = null;
          if (!inCheck) return true;
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<ShogiState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<ShogiState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const w = this.getData<ShogiState>().winner;
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === w ? 1 : 0;
    return scores;
  }
}
