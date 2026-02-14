import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TakConfig {
  boardSize?: number;
}

/**
 * Tak: Abstract strategy game. Players place flat stones, standing stones (walls),
 * or capstones. Win by building a road connecting opposite edges.
 * Stacks can be moved; the top piece controls the stack.
 * Standing stones block movement; capstones can flatten standing stones.
 */

interface TakPiece {
  owner: string;
  type: 'flat' | 'wall' | 'cap';
}

interface TakState {
  [key: string]: unknown;
  board: TakPiece[][][]; // board[r][c] = stack of pieces (top = last)
  currentPlayer: number;
  winner: string | null;
  size: number;
  reserves: Record<string, { flats: number; caps: number }>;
  turnNumber: number;
}

const PIECE_COUNTS: Record<number, { flats: number; caps: number }> = {
  3: { flats: 10, caps: 0 },
  4: { flats: 15, caps: 0 },
  5: { flats: 21, caps: 1 },
  6: { flats: 30, caps: 1 },
  8: { flats: 50, caps: 2 },
};

export class TakGame extends BaseGame {
  readonly name = 'Tak';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): TakState {
    const size = (this.config as TakConfig).boardSize ?? 5;
    const counts = PIECE_COUNTS[size] || { flats: 21, caps: 1 };
    const board: TakPiece[][][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => []),
    );
    const reserves: Record<string, { flats: number; caps: number }> = {};
    for (const pid of playerIds) {
      reserves[pid] = { ...counts };
    }
    return {
      board,
      currentPlayer: 0,
      winner: null,
      size,
      reserves,
      turnNumber: 0,
    };
  }

  private topPiece(stack: TakPiece[]): TakPiece | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  private checkRoad(data: TakState, playerId: string): boolean {
    const { board, size } = data;
    // BFS/DFS from left edge to right edge, and top edge to bottom edge
    const visited = Array.from({ length: size }, () => Array(size).fill(false));

    const isRoadPiece = (r: number, c: number): boolean => {
      const top = this.topPiece(board[r][c]);
      if (!top) return false;
      if (top.owner !== playerId) return false;
      return top.type === 'flat' || top.type === 'cap';
    };

    const bfs = (
      startCells: [number, number][],
      isGoal: (r: number, c: number) => boolean,
    ): boolean => {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) visited[r][c] = false;
      }
      const queue: [number, number][] = [];
      for (const [r, c] of startCells) {
        if (isRoadPiece(r, c)) {
          visited[r][c] = true;
          queue.push([r, c]);
        }
      }
      let head = 0;
      while (head < queue.length) {
        const [r, c] = queue[head++];
        if (isGoal(r, c)) return true;
        const dirs: [number, number][] = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < size &&
            nc >= 0 &&
            nc < size &&
            !visited[nr][nc] &&
            isRoadPiece(nr, nc)
          ) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }
      return false;
    };

    // Left to right
    const leftEdge: [number, number][] = [];
    for (let r = 0; r < size; r++) leftEdge.push([r, 0]);
    if (bfs(leftEdge, (_r, c) => c === size - 1)) return true;

    // Top to bottom
    const topEdge: [number, number][] = [];
    for (let c = 0; c < size; c++) topEdge.push([0, c]);
    if (bfs(topEdge, (r, _c) => r === size - 1)) return true;

    return false;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TakState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'place') {
      const r = Number(action.payload.row);
      const c = Number(action.payload.col);
      const pieceType = (action.payload.pieceType as string) || 'flat';

      if (isNaN(r) || isNaN(c) || r < 0 || r >= data.size || c < 0 || c >= data.size) {
        return { success: false, error: 'Invalid position' };
      }
      if (data.board[r][c].length > 0) {
        return { success: false, error: 'Position occupied' };
      }

      // First turn: each player must place a flat of the OPPONENT's color
      if (data.turnNumber < 2) {
        const opponentId = players[1 - pIdx];
        if (pieceType !== 'flat') {
          return { success: false, error: 'First placement must be a flat stone' };
        }
        if (data.reserves[opponentId].flats <= 0) {
          return { success: false, error: 'Opponent has no flats remaining' };
        }
        data.reserves[opponentId].flats--;
        data.board[r][c].push({ owner: opponentId, type: 'flat' });
      } else {
        const reserves = data.reserves[playerId];
        if (pieceType === 'cap') {
          if (reserves.caps <= 0) return { success: false, error: 'No capstones remaining' };
          reserves.caps--;
        } else {
          if (reserves.flats <= 0) return { success: false, error: 'No flat stones remaining' };
          reserves.flats--;
        }
        data.board[r][c].push({ owner: playerId, type: pieceType as 'flat' | 'wall' | 'cap' });
      }

      data.turnNumber++;
      // Check road win
      for (const pid of players) {
        if (this.checkRoad(data, pid)) {
          data.winner = pid;
          this.emitEvent('road_win', pid, {});
        }
      }

      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'move') {
      if (data.turnNumber < 2) {
        return { success: false, error: 'Must place a piece on the first turn' };
      }
      const fromR = Number(action.payload.fromRow);
      const fromC = Number(action.payload.fromCol);
      const direction = action.payload.direction as string; // 'up' | 'down' | 'left' | 'right'
      const drops = action.payload.drops as number[];

      if (
        isNaN(fromR) ||
        isNaN(fromC) ||
        fromR < 0 ||
        fromR >= data.size ||
        fromC < 0 ||
        fromC >= data.size
      ) {
        return { success: false, error: 'Invalid source position' };
      }

      const stack = data.board[fromR][fromC];
      const top = this.topPiece(stack);
      if (!top || top.owner !== playerId) {
        return { success: false, error: 'You do not control this stack' };
      }

      if (!drops || !Array.isArray(drops) || drops.length === 0) {
        return { success: false, error: 'Must specify drops array' };
      }

      const carryCount = drops.reduce((a: number, b: number) => a + b, 0);
      if (carryCount > data.size) {
        return { success: false, error: `Cannot carry more than ${data.size} pieces` };
      }
      if (carryCount > stack.length) {
        return { success: false, error: 'Not enough pieces in stack' };
      }

      const dirMap: Record<string, [number, number]> = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const dir = dirMap[direction];
      if (!dir) {
        return { success: false, error: 'Invalid direction (up, down, left, right)' };
      }

      // Pick up pieces from top of stack
      const carried = stack.splice(stack.length - carryCount, carryCount);

      let cr = fromR;
      let cc = fromC;
      let carryIdx = 0;
      for (let i = 0; i < drops.length; i++) {
        cr += dir[0];
        cc += dir[1];
        if (cr < 0 || cr >= data.size || cc < 0 || cc >= data.size) {
          // Undo
          stack.push(...carried);
          return { success: false, error: 'Move goes off board' };
        }
        const targetTop = this.topPiece(data.board[cr][cc]);
        if (targetTop) {
          if (targetTop.type === 'wall') {
            // Only capstone on the last drop can flatten a wall
            if (i !== drops.length - 1 || drops[i] !== 1 || carried[carryIdx].type !== 'cap') {
              stack.push(...carried);
              return { success: false, error: 'Cannot move onto a wall' };
            }
            targetTop.type = 'flat';
          } else if (targetTop.type === 'cap') {
            stack.push(...carried);
            return { success: false, error: 'Cannot move onto a capstone' };
          }
        }
        const toDrop = carried.splice(0, drops[i]);
        data.board[cr][cc].push(...toDrop);
        carryIdx += drops[i];
      }

      data.turnNumber++;
      // Check road win
      for (const pid of players) {
        if (this.checkRoad(data, pid)) {
          data.winner = pid;
          this.emitEvent('road_win', pid, {});
        }
      }

      data.currentPlayer = 1 - pIdx;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<TakState>();
    if (data.winner) return true;
    // Check if board is full or both players are out of pieces
    const { board, size, reserves } = data;
    const players = this.getPlayers();
    let boardFull = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c].length === 0) {
          boardFull = false;
          break;
        }
      }
      if (!boardFull) break;
    }
    const bothEmpty = players.every((pid) => reserves[pid].flats === 0 && reserves[pid].caps === 0);
    return boardFull || bothEmpty;
  }

  protected determineWinner(): string | null {
    const data = this.getData<TakState>();
    if (data.winner) return data.winner;
    // Flat count: whoever has more top flats wins
    const players = this.getPlayers();
    const counts: Record<string, number> = {};
    for (const pid of players) counts[pid] = 0;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        const top = this.topPiece(data.board[r][c]);
        if (top && top.type === 'flat' && counts[top.owner] !== undefined) {
          counts[top.owner]++;
        }
      }
    }
    let best: string | null = null;
    let bestCount = -1;
    for (const pid of players) {
      if (counts[pid] > bestCount) {
        bestCount = counts[pid];
        best = pid;
      } else if (counts[pid] === bestCount) best = null; // tie
    }
    return best;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<TakState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    for (const pid of players) scores[pid] = 0;
    for (let r = 0; r < data.size; r++) {
      for (let c = 0; c < data.size; c++) {
        const top = this.topPiece(data.board[r][c]);
        if (top && top.type === 'flat' && scores[top.owner] !== undefined) {
          scores[top.owner]++;
        }
      }
    }
    return scores;
  }
}
