/**
 * Shared chess helpers for chess variant ports.
 */

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface ChessPiece {
  type: PieceType;
  owner: string;
  moved: boolean;
}

export type Board = (ChessPiece | null)[][];

export function createEmptyBoard(rows: number, cols: number): Board {
  const board: Board = [];
  for (let r = 0; r < rows; r++) board.push(Array(cols).fill(null));
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function standardBackRow(): PieceType[] {
  return ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
}

export function setupStandardBoard(playerIds: string[]): Board {
  const board = createEmptyBoard(8, 8);
  const backRow = standardBackRow();
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRow[c], owner: playerIds[1], moved: false };
    board[1][c] = { type: 'P', owner: playerIds[1], moved: false };
    board[6][c] = { type: 'P', owner: playerIds[0], moved: false };
    board[7][c] = { type: backRow[c], owner: playerIds[0], moved: false };
  }
  return board;
}

export function inBounds(r: number, c: number, rows = 8, cols = 8): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

export function isPathClear(
  board: Board,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
): boolean {
  const dr = Math.sign(toR - fromR);
  const dc = Math.sign(toC - fromC);
  let r = fromR + dr;
  let c = fromC + dc;
  while (r !== toR || c !== toC) {
    if (board[r][c] !== null) return false;
    r += dr;
    c += dc;
  }
  return true;
}

export function isPseudoLegalMove(
  board: Board,
  piece: ChessPiece,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  playerIdx: number,
  enPassantTarget: [number, number] | null,
  rows = 8,
  cols = 8,
): boolean {
  if (!inBounds(toR, toC, rows, cols)) return false;
  if (fromR === toR && fromC === toC) return false;
  const target = board[toR][toC];
  if (target && target.owner === piece.owner) return false;

  const dr = toR - fromR;
  const dc = toC - fromC;
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
        if (enPassantTarget && toR === enPassantTarget[0] && toC === enPassantTarget[1])
          return true;
      }
      return false;
    }
    case 'N':
      return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    case 'B':
      return absDr === absDc && isPathClear(board, fromR, fromC, toR, toC);
    case 'R':
      return (dr === 0 || dc === 0) && isPathClear(board, fromR, fromC, toR, toC);
    case 'Q':
      return (
        (absDr === absDc || dr === 0 || dc === 0) && isPathClear(board, fromR, fromC, toR, toC)
      );
    case 'K':
      return absDr <= 1 && absDc <= 1;
  }
}

export function findKing(
  board: Board,
  player: string,
  rows = 8,
  cols = 8,
): [number, number] | null {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = board[r][c];
      if (p && p.type === 'K' && p.owner === player) return [r, c];
    }
  }
  return null;
}

export function isSquareAttacked(
  board: Board,
  row: number,
  col: number,
  attacker: string,
  attackerIdx: number,
  enPassantTarget: [number, number] | null,
  rows = 8,
  cols = 8,
): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = board[r][c];
      if (piece && piece.owner === attacker) {
        if (
          isPseudoLegalMove(board, piece, r, c, row, col, attackerIdx, enPassantTarget, rows, cols)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function isKingInCheck(
  board: Board,
  player: string,
  players: string[],
  enPassantTarget: [number, number] | null,
  rows = 8,
  cols = 8,
): boolean {
  const kingPos = findKing(board, player, rows, cols);
  if (!kingPos) return false;
  const [kr, kc] = kingPos;
  for (let i = 0; i < players.length; i++) {
    if (players[i] === player) continue;
    if (isSquareAttacked(board, kr, kc, players[i], i, enPassantTarget, rows, cols)) return true;
  }
  return false;
}

export function isLegalMoveStandard(
  board: Board,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  player: string,
  playerIdx: number,
  players: string[],
  enPassantTarget: [number, number] | null,
  castlingRights?: { kingSide: boolean; queenSide: boolean }[],
  rows = 8,
  cols = 8,
): boolean {
  if (!inBounds(toR, toC, rows, cols)) return false;
  if (fromR === toR && fromC === toC) return false;

  const piece = board[fromR][fromC];
  if (!piece || piece.owner !== player) return false;
  const target = board[toR][toC];
  if (target && target.owner === player) return false;

  // Castling check
  if (piece.type === 'K' && Math.abs(toC - fromC) === 2 && toR === fromR && castlingRights) {
    const rights = castlingRights[playerIdx];
    if (!rights || piece.moved) return false;
    const dc = toC - fromC;
    if (dc === 2 && rights.kingSide) {
      const rook = board[fromR][cols - 1];
      if (!rook || rook.type !== 'R' || rook.moved) return false;
      if (!isPathClear(board, fromR, fromC, fromR, cols - 1)) return false;
    } else if (dc === -2 && rights.queenSide) {
      const rook = board[fromR][0];
      if (!rook || rook.type !== 'R' || rook.moved) return false;
      if (!isPathClear(board, fromR, fromC, fromR, 0)) return false;
    } else {
      return false;
    }
    // Check not in check, through check, or into check
    if (isKingInCheck(board, player, players, enPassantTarget, rows, cols)) return false;
    const midC = (fromC + toC) / 2;
    const savedMid = board[fromR][midC];
    board[fromR][midC] = piece;
    board[fromR][fromC] = null;
    const midCheck = isKingInCheck(board, player, players, enPassantTarget, rows, cols);
    board[fromR][fromC] = piece;
    board[fromR][midC] = savedMid;
    if (midCheck) return false;
    // Check destination
    const savedDest = board[toR][toC];
    board[toR][toC] = piece;
    board[fromR][fromC] = null;
    const destCheck = isKingInCheck(board, player, players, enPassantTarget, rows, cols);
    board[fromR][fromC] = piece;
    board[toR][toC] = savedDest;
    return !destCheck;
  }

  if (
    !isPseudoLegalMove(board, piece, fromR, fromC, toR, toC, playerIdx, enPassantTarget, rows, cols)
  ) {
    return false;
  }

  // Simulate move
  const saved = board[toR][toC];
  board[toR][toC] = piece;
  board[fromR][fromC] = null;
  let epCapture = false;
  let savedEp: ChessPiece | null = null;
  if (
    piece.type === 'P' &&
    enPassantTarget &&
    toR === enPassantTarget[0] &&
    toC === enPassantTarget[1]
  ) {
    savedEp = board[fromR][toC];
    board[fromR][toC] = null;
    epCapture = true;
  }

  const inCheck = isKingInCheck(board, player, players, enPassantTarget, rows, cols);

  board[fromR][fromC] = piece;
  board[toR][toC] = saved;
  if (epCapture) board[fromR][toC] = savedEp;

  return !inCheck;
}

export function hasAnyLegalMove(
  board: Board,
  player: string,
  playerIdx: number,
  players: string[],
  enPassantTarget: [number, number] | null,
  castlingRights?: { kingSide: boolean; queenSide: boolean }[],
  rows = 8,
  cols = 8,
): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== player) continue;
      for (let tr = 0; tr < rows; tr++) {
        for (let tc = 0; tc < cols; tc++) {
          if (
            isLegalMoveStandard(
              board,
              r,
              c,
              tr,
              tc,
              player,
              playerIdx,
              players,
              enPassantTarget,
              castlingRights,
              rows,
              cols,
            )
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function executeStandardMove(
  board: Board,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  enPassantTarget: [number, number] | null,
  castlingRights: { kingSide: boolean; queenSide: boolean }[],
  playerIdx: number,
  promotion?: PieceType,
  cols = 8,
): { captured: ChessPiece | null; newEpTarget: [number, number] | null } {
  const piece = board[fromR][fromC]!;
  let captured = board[toR][toC];

  // En passant
  if (
    piece.type === 'P' &&
    enPassantTarget &&
    toR === enPassantTarget[0] &&
    toC === enPassantTarget[1]
  ) {
    captured = board[fromR][toC];
    board[fromR][toC] = null;
  }

  // Castling
  if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
    if (toC > fromC) {
      board[fromR][toC - 1] = board[fromR][cols - 1];
      board[fromR][cols - 1] = null;
      if (board[fromR][toC - 1]) board[fromR][toC - 1]!.moved = true;
    } else {
      board[fromR][toC + 1] = board[fromR][0];
      board[fromR][0] = null;
      if (board[fromR][toC + 1]) board[fromR][toC + 1]!.moved = true;
    }
  }

  // New en passant target
  let newEpTarget: [number, number] | null = null;
  if (piece.type === 'P' && Math.abs(toR - fromR) === 2) {
    newEpTarget = [(fromR + toR) / 2, fromC];
  }

  board[toR][toC] = piece;
  board[fromR][fromC] = null;
  piece.moved = true;

  // Promotion
  if (piece.type === 'P' && (toR === 0 || toR === board.length - 1)) {
    const validPromo: PieceType[] = ['Q', 'R', 'B', 'N'];
    piece.type = promotion && validPromo.includes(promotion) ? promotion : 'Q';
  }

  // Update castling rights
  if (piece.type === 'K') {
    castlingRights[playerIdx].kingSide = false;
    castlingRights[playerIdx].queenSide = false;
  }
  if (piece.type === 'R' || (board[fromR] && fromC === 0)) {
    // Check original rook positions
  }
  if (fromC === 0 && board[fromR]?.[fromC] === null) {
    // Moved from queen-side rook position
    if (fromR === (playerIdx === 0 ? board.length - 1 : 0)) {
      castlingRights[playerIdx].queenSide = false;
    }
  }
  if (fromC === cols - 1 && board[fromR]?.[fromC] === null) {
    if (fromR === (playerIdx === 0 ? board.length - 1 : 0)) {
      castlingRights[playerIdx].kingSide = false;
    }
  }

  return { captured, newEpTarget };
}

export function parseSquare(sq: string): [number, number] | null {
  if (sq.length < 2) return null;
  const col = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - parseInt(sq.substring(1), 10);
  if (isNaN(row) || col < 0 || col > 7 || row < 0 || row > 7) return null;
  return [row, col];
}

export function toSquare(row: number, col: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row).toString();
}
