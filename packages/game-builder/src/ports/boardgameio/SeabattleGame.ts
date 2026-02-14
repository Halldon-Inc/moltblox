import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SeabattleConfig {
  gridSize?: number;
}

/**
 * Seabattle (Battleship): Place ships on a grid, take turns guessing
 * opponent ship locations. Hit all opponent ships to win.
 * Ships: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)
 */

interface Ship {
  name: string;
  size: number;
  positions: [number, number][];
  hits: boolean[];
}

interface PlayerGrid {
  ships: Ship[];
  shots: Record<string, 'hit' | 'miss'>;
  allPlaced: boolean;
}

interface SeabattleState {
  [key: string]: unknown;
  grids: Record<string, PlayerGrid>;
  currentPlayer: number;
  phase: string; // 'setup' | 'battle'
  gridSize: number;
  winner: string | null;
}

const SHIP_DEFS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 },
];

export class SeabattleGame extends BaseGame {
  readonly name = 'Seabattle';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): SeabattleState {
    const gridSize = (this.config as SeabattleConfig).gridSize ?? 10;
    const grids: Record<string, PlayerGrid> = {};
    for (const pid of playerIds) {
      grids[pid] = { ships: [], shots: {}, allPlaced: false };
    }
    return {
      grids,
      currentPlayer: 0,
      phase: 'setup',
      gridSize,
      winner: null,
    };
  }

  private posKey(r: number, c: number): string {
    return `${r},${c}`;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SeabattleState>();
    const players = this.getPlayers();

    if (data.phase === 'setup') {
      if (action.type !== 'place_ship') {
        return { success: false, error: 'Must place ships during setup (action: place_ship)' };
      }

      const grid = data.grids[playerId];
      if (!grid) return { success: false, error: 'Not a valid player' };
      if (grid.allPlaced) return { success: false, error: 'All ships already placed' };

      const shipName = action.payload.ship as string;
      const row = Number(action.payload.row);
      const col = Number(action.payload.col);
      const horizontal = action.payload.horizontal !== false;

      const def = SHIP_DEFS.find((s) => s.name === shipName);
      if (!def) return { success: false, error: `Unknown ship: ${shipName}` };
      if (grid.ships.some((s) => s.name === shipName)) {
        return { success: false, error: `${shipName} already placed` };
      }

      // Generate positions
      const positions: [number, number][] = [];
      for (let i = 0; i < def.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r < 0 || r >= data.gridSize || c < 0 || c >= data.gridSize) {
          return { success: false, error: 'Ship goes off grid' };
        }
        positions.push([r, c]);
      }

      // Check overlap
      const occupied = new Set<string>();
      for (const ship of grid.ships) {
        for (const [r, c] of ship.positions) occupied.add(this.posKey(r, c));
      }
      for (const [r, c] of positions) {
        if (occupied.has(this.posKey(r, c))) {
          return { success: false, error: 'Ship overlaps another' };
        }
      }

      grid.ships.push({
        name: def.name,
        size: def.size,
        positions,
        hits: Array(def.size).fill(false),
      });

      if (grid.ships.length === SHIP_DEFS.length) {
        grid.allPlaced = true;
      }

      // Check if both players are done with setup
      if (players.every((pid) => data.grids[pid].allPlaced)) {
        data.phase = 'battle';
        data.currentPlayer = 0;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Battle phase
    const pIdx = data.currentPlayer;
    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type !== 'fire') {
      return { success: false, error: 'Must fire during battle (action: fire)' };
    }

    const targetRow = Number(action.payload.row);
    const targetCol = Number(action.payload.col);
    if (
      isNaN(targetRow) ||
      isNaN(targetCol) ||
      targetRow < 0 ||
      targetRow >= data.gridSize ||
      targetCol < 0 ||
      targetCol >= data.gridSize
    ) {
      return { success: false, error: 'Invalid target' };
    }

    const opponentId = players[1 - pIdx];
    const opponentGrid = data.grids[opponentId];
    const myGrid = data.grids[playerId];
    const shotKey = this.posKey(targetRow, targetCol);

    if (myGrid.shots[shotKey]) {
      return { success: false, error: 'Already fired at this position' };
    }

    // Check for hit
    let hit = false;
    let sunkShip: string | null = null;
    for (const ship of opponentGrid.ships) {
      for (let i = 0; i < ship.positions.length; i++) {
        if (ship.positions[i][0] === targetRow && ship.positions[i][1] === targetCol) {
          ship.hits[i] = true;
          hit = true;
          if (ship.hits.every(Boolean)) {
            sunkShip = ship.name;
            this.emitEvent('ship_sunk', playerId, { ship: ship.name });
          }
          break;
        }
      }
      if (hit) break;
    }

    myGrid.shots[shotKey] = hit ? 'hit' : 'miss';
    this.emitEvent(hit ? 'hit' : 'miss', playerId, {
      row: targetRow,
      col: targetCol,
      sunk: sunkShip,
    });

    // Check win
    const allSunk = opponentGrid.ships.every((s) => s.hits.every(Boolean));
    if (allSunk) {
      data.winner = playerId;
    }

    data.currentPlayer = 1 - pIdx;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as SeabattleState;
    const players = this.getPlayers();
    // Hide opponent's ship positions
    for (const pid of players) {
      if (pid !== playerId && data.grids[pid]) {
        data.grids[pid] = {
          ...data.grids[pid],
          ships: data.grids[pid].ships.map((s) => ({
            ...s,
            positions: s.hits.every(Boolean) ? s.positions : [], // Only show sunk ship positions
          })),
        };
      }
    }
    return state;
  }

  protected checkGameOver(): boolean {
    return this.getData<SeabattleState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<SeabattleState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SeabattleState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      let hits = 0;
      for (const v of Object.values(data.grids[p]?.shots ?? {})) {
        if (v === 'hit') hits++;
      }
      scores[p] = hits;
    }
    return scores;
  }
}
