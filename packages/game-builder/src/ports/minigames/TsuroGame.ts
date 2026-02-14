import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface TsuroState {
  [key: string]: unknown;
  boardSize: number;
  board: (number[] | null)[][];
  positions: Record<string, { row: number; col: number; port: number }>;
  eliminated: string[];
  currentPlayer: number;
  hands: Record<string, number[][]>;
}

export class TsuroGame extends BaseGame {
  readonly name = 'Tsuro';
  readonly version = '1.0.0';
  readonly maxPlayers = 8;

  private generateTile(): number[] {
    // 8 ports (0-7), paired: [0->5, 1->4, 2->7, 3->6] for a default tile
    const pairs = [0, 1, 2, 3, 4, 5, 6, 7];
    // Shuffle pairing
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    const tile = Array(8).fill(0);
    for (let i = 0; i < 8; i += 2) {
      tile[pairs[i]] = pairs[i + 1];
      tile[pairs[i + 1]] = pairs[i];
    }
    return tile;
  }

  protected initializeState(playerIds: string[]): TsuroState {
    const boardSize = 6;
    const positions: Record<string, { row: number; col: number; port: number }> = {};
    // Place players at edges
    const starts = [
      { row: 0, col: 0, port: 0 },
      { row: 0, col: 3, port: 1 },
      { row: 3, col: 5, port: 2 },
      { row: 5, col: 3, port: 4 },
      { row: 5, col: 0, port: 5 },
      { row: 3, col: 0, port: 6 },
      { row: 0, col: 2, port: 0 },
      { row: 2, col: 5, port: 2 },
    ];
    playerIds.forEach((p, i) => {
      positions[p] = starts[i % starts.length];
    });

    const hands: Record<string, number[][]> = {};
    for (const p of playerIds) {
      hands[p] = [this.generateTile(), this.generateTile(), this.generateTile()];
    }

    return {
      boardSize,
      board: Array.from({ length: boardSize }, () => Array(boardSize).fill(null)),
      positions,
      eliminated: [],
      currentPlayer: 0,
      hands,
    };
  }

  private rotateTile(tile: number[], times: number): number[] {
    let t = [...tile];
    for (let i = 0; i < times; i++) {
      const nt = Array(8).fill(0);
      for (let p = 0; p < 8; p++) {
        nt[(p + 2) % 8] = (t[p] + 2) % 8;
      }
      t = nt;
    }
    return t;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<TsuroState>();
    const players = this.getPlayers().filter((p) => !d.eliminated.includes(p));
    if (players[d.currentPlayer % players.length] !== playerId)
      return { success: false, error: 'Not your turn' };
    if (action.type !== 'place') return { success: false, error: 'Use place action' };

    const tileId = Number(action.payload.tileId);
    const rotation = Number(action.payload.rotation || 0);
    const hand = d.hands[playerId];
    if (tileId < 0 || tileId >= hand.length) return { success: false, error: 'Invalid tile' };

    const tile = this.rotateTile(hand[tileId], rotation);
    const pos = d.positions[playerId];
    if (!pos) return { success: false, error: 'Player not on board' };

    if (d.board[pos.row]?.[pos.col] !== null) return { success: false, error: 'Cell occupied' };
    d.board[pos.row][pos.col] = tile;
    hand.splice(tileId, 1);

    // Follow path for all players on this tile
    for (const pid of Object.keys(d.positions)) {
      if (d.eliminated.includes(pid)) continue;
      const p = d.positions[pid];
      if (p.row === pos.row && p.col === pos.col) {
        const exit = tile[p.port];
        // Move to next cell
        const dr = exit < 2 ? -1 : exit < 4 ? 0 : exit < 6 ? 1 : 0;
        const dc = exit >= 2 && exit < 4 ? 1 : exit >= 6 ? -1 : 0;
        p.row += dr;
        p.col += dc;
        p.port = (exit + 4) % 8;
        if (p.row < 0 || p.row >= d.boardSize || p.col < 0 || p.col >= d.boardSize) {
          d.eliminated.push(pid);
        }
      }
    }

    // Refill hand
    if (hand.length < 3) hand.push(this.generateTile());

    // Next alive player
    const alive = this.getPlayers().filter((p) => !d.eliminated.includes(p));
    if (alive.length > 1) {
      d.currentPlayer = (d.currentPlayer + 1) % alive.length;
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<TsuroState>();
    const alive = this.getPlayers().filter((p) => !d.eliminated.includes(p));
    return alive.length <= 1;
  }

  protected determineWinner(): string | null {
    const d = this.getData<TsuroState>();
    const alive = this.getPlayers().filter((p) => !d.eliminated.includes(p));
    return alive.length === 1 ? alive[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<TsuroState>();
    const scores: Record<string, number> = {};
    const players = this.getPlayers();
    for (let i = 0; i < players.length; i++) {
      const elimIdx = d.eliminated.indexOf(players[i]);
      scores[players[i]] = elimIdx < 0 ? 100 : elimIdx;
    }
    return scores;
  }
}
