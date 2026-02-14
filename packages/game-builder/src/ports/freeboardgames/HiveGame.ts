import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type PieceType = 'queen' | 'ant' | 'beetle' | 'grasshopper' | 'spider';

interface HivePiece {
  type: PieceType;
  owner: number; // 0 or 1
  q: number; // hex axial coordinate
  r: number;
}

interface HivePlayerState {
  unplaced: Record<PieceType, number>;
  queenPlaced: boolean;
}

interface HiveState {
  [key: string]: unknown;
  pieces: HivePiece[];
  playerState: [HivePlayerState, HivePlayerState];
  currentPlayer: number;
  turnCount: number;
  winner: string | null;
  gameEnded: boolean;
}

const STARTING_PIECES: Record<PieceType, number> = {
  queen: 1,
  ant: 3,
  beetle: 2,
  grasshopper: 3,
  spider: 2,
};

const HEX_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

export class HiveGame extends BaseGame {
  readonly name = 'Hive';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): HiveState {
    return {
      pieces: [],
      playerState: [
        { unplaced: { ...STARTING_PIECES }, queenPlaced: false },
        { unplaced: { ...STARTING_PIECES }, queenPlaced: false },
      ],
      currentPlayer: 0,
      turnCount: 0,
      winner: null,
      gameEnded: false,
    };
  }

  private pieceAt(pieces: HivePiece[], q: number, r: number): HivePiece | undefined {
    return pieces.find((p) => p.q === q && p.r === r);
  }

  private neighbors(q: number, r: number): [number, number][] {
    return HEX_DIRS.map(([dq, dr]) => [q + dq, r + dr] as [number, number]);
  }

  private isConnected(pieces: HivePiece[], excludeIdx?: number): boolean {
    const remaining = pieces.filter((_, i) => i !== excludeIdx);
    if (remaining.length <= 1) return true;

    const visited = new Set<string>();
    const queue: [number, number][] = [[remaining[0].q, remaining[0].r]];
    visited.add(`${remaining[0].q},${remaining[0].r}`);

    while (queue.length > 0) {
      const [q, r] = queue.shift()!;
      for (const [nq, nr] of this.neighbors(q, r)) {
        const key = `${nq},${nr}`;
        if (!visited.has(key) && remaining.some((p) => p.q === nq && p.r === nr)) {
          visited.add(key);
          queue.push([nq, nr]);
        }
      }
    }

    return visited.size === remaining.length;
  }

  private hasAdjacentFriendly(pieces: HivePiece[], q: number, r: number, owner: number): boolean {
    return this.neighbors(q, r).some(([nq, nr]) => {
      const p = this.pieceAt(pieces, nq, nr);
      return p && p.owner === owner;
    });
  }

  private hasAdjacentEnemy(pieces: HivePiece[], q: number, r: number, owner: number): boolean {
    return this.neighbors(q, r).some(([nq, nr]) => {
      const p = this.pieceAt(pieces, nq, nr);
      return p && p.owner !== owner;
    });
  }

  private isQueenSurrounded(pieces: HivePiece[], owner: number): boolean {
    const queen = pieces.find((p) => p.type === 'queen' && p.owner === owner);
    if (!queen) return false;
    return this.neighbors(queen.q, queen.r).every(
      ([nq, nr]) => this.pieceAt(pieces, nq, nr) !== undefined,
    );
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<HiveState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) return { success: false, error: 'Not your turn' };

    const ps = data.playerState[pIdx];

    if (action.type === 'place') {
      const pieceType = action.payload.piece as PieceType;
      const q = Number(action.payload.q);
      const r = Number(action.payload.r);

      if (!ps.unplaced[pieceType] || ps.unplaced[pieceType] <= 0) {
        return { success: false, error: 'No pieces of that type left' };
      }

      // Must place queen by turn 4
      if (data.turnCount >= 6 && !ps.queenPlaced && pieceType !== 'queen') {
        return { success: false, error: 'Must place queen by your 4th turn' };
      }

      if (this.pieceAt(data.pieces, q, r)) {
        return { success: false, error: 'Space occupied' };
      }

      // First piece: anywhere; second piece: adjacent to first
      if (data.pieces.length === 0) {
        // OK, first piece
      } else if (data.pieces.length === 1) {
        // Must be adjacent to first piece
        if (!this.neighbors(q, r).some(([nq, nr]) => this.pieceAt(data.pieces, nq, nr))) {
          return { success: false, error: 'Must place adjacent to existing pieces' };
        }
      } else {
        // Must be adjacent to friendly, NOT adjacent to enemy
        if (!this.hasAdjacentFriendly(data.pieces, q, r, pIdx)) {
          return { success: false, error: 'Must place adjacent to your own pieces' };
        }
        if (this.hasAdjacentEnemy(data.pieces, q, r, pIdx)) {
          return { success: false, error: 'Cannot place adjacent to opponent pieces' };
        }
      }

      data.pieces.push({ type: pieceType, owner: pIdx, q, r });
      ps.unplaced[pieceType]--;
      if (pieceType === 'queen') ps.queenPlaced = true;
    } else if (action.type === 'move') {
      if (!ps.queenPlaced) {
        return { success: false, error: 'Must place queen before moving' };
      }

      const fromQ = Number(action.payload.fromQ);
      const fromR = Number(action.payload.fromR);
      const toQ = Number(action.payload.toQ);
      const toR = Number(action.payload.toR);

      const pieceIdx = data.pieces.findIndex(
        (p) => p.q === fromQ && p.r === fromR && p.owner === pIdx,
      );
      if (pieceIdx === -1) return { success: false, error: 'No piece at source' };

      if (this.pieceAt(data.pieces, toQ, toR)) {
        return { success: false, error: 'Destination occupied' };
      }

      // Check one-hive rule: removing piece must keep hive connected
      if (!this.isConnected(data.pieces, pieceIdx)) {
        return { success: false, error: 'Move would break the hive' };
      }

      // Must be adjacent to at least one piece at destination
      const hasNeighborAtDest = this.neighbors(toQ, toR).some(([nq, nr]) => {
        if (nq === fromQ && nr === fromR) return false;
        return this.pieceAt(data.pieces, nq, nr) !== undefined;
      });
      if (!hasNeighborAtDest) return { success: false, error: 'Must stay connected to hive' };

      data.pieces[pieceIdx].q = toQ;
      data.pieces[pieceIdx].r = toR;
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    data.turnCount++;
    data.currentPlayer = 1 - pIdx;

    // Check win conditions
    const p0Surrounded = this.isQueenSurrounded(data.pieces, 0);
    const p1Surrounded = this.isQueenSurrounded(data.pieces, 1);
    if (p0Surrounded && p1Surrounded) {
      data.gameEnded = true;
      data.winner = null; // Draw
    } else if (p0Surrounded) {
      data.gameEnded = true;
      data.winner = players[1];
    } else if (p1Surrounded) {
      data.gameEnded = true;
      data.winner = players[0];
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<HiveState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<HiveState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = p === winner ? 1 : 0;
    }
    return scores;
  }
}
