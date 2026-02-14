import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BattleshipConfig {
  boardSize?: number;
}

interface Ship {
  name: string;
  size: number;
  positions: [number, number][];
  hits: boolean[];
}

interface BattleshipState {
  [key: string]: unknown;
  boards: Record<string, (string | null)[][]>;
  shots: Record<string, boolean[][]>;
  ships: Record<string, Ship[]>;
  currentPlayer: number;
  setupComplete: Record<string, boolean>;
  winner: string | null;
  size: number;
}

export class BattleshipGame extends BaseGame {
  readonly name = 'Battleship';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private readonly shipDefs = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 },
  ];

  protected initializeState(playerIds: string[]): BattleshipState {
    const size = (this.config as BattleshipConfig).boardSize ?? 10;
    const boards: Record<string, (string | null)[][]> = {};
    const shots: Record<string, boolean[][]> = {};
    const ships: Record<string, Ship[]> = {};
    const setupComplete: Record<string, boolean> = {};

    for (const p of playerIds) {
      boards[p] = [];
      shots[p] = [];
      for (let r = 0; r < size; r++) {
        boards[p].push(Array(size).fill(null));
        shots[p].push(Array(size).fill(false));
      }
      ships[p] = [];
      setupComplete[p] = false;
    }

    return { boards, shots, ships, currentPlayer: 0, setupComplete, winner: null, size };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BattleshipState>();
    const players = this.getPlayers();

    if (action.type === 'place_ship') {
      if (data.setupComplete[playerId]) return { success: false, error: 'Setup already complete' };

      const row = Number(action.payload.row);
      const col = Number(action.payload.col);
      const horizontal = action.payload.horizontal !== false;
      const shipIdx = data.ships[playerId].length;

      if (shipIdx >= this.shipDefs.length) return { success: false, error: 'All ships placed' };

      const shipDef = this.shipDefs[shipIdx];
      const positions: [number, number][] = [];

      for (let i = 0; i < shipDef.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r < 0 || r >= data.size || c < 0 || c >= data.size)
          return { success: false, error: 'Ship out of bounds' };
        if (data.boards[playerId][r][c] !== null)
          return { success: false, error: 'Overlapping ships' };
        positions.push([r, c]);
      }

      for (const [r, c] of positions) data.boards[playerId][r][c] = shipDef.name;
      data.ships[playerId].push({
        name: shipDef.name,
        size: shipDef.size,
        positions,
        hits: Array(shipDef.size).fill(false),
      });

      if (data.ships[playerId].length === this.shipDefs.length) {
        data.setupComplete[playerId] = true;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'shoot') {
      if (!players.every((p) => data.setupComplete[p]))
        return { success: false, error: 'Setup not complete' };
      if (players[data.currentPlayer] !== playerId)
        return { success: false, error: 'Not your turn' };

      const row = Number(action.payload.row);
      const col = Number(action.payload.col);
      if (isNaN(row) || isNaN(col) || row < 0 || row >= data.size || col < 0 || col >= data.size) {
        return { success: false, error: 'Invalid coordinates' };
      }

      const opponent = players[(data.currentPlayer + 1) % 2];
      if (data.shots[playerId][row][col]) return { success: false, error: 'Already shot there' };

      data.shots[playerId][row][col] = true;
      const target = data.boards[opponent][row][col];

      if (target !== null) {
        const ship = data.ships[opponent].find((s) => s.name === target)!;
        const posIdx = ship.positions.findIndex(([r, c]) => r === row && c === col);
        ship.hits[posIdx] = true;
        const sunk = ship.hits.every((h) => h);
        this.emitEvent(sunk ? 'sunk' : 'hit', playerId, { row, col, ship: target });

        // Check if all ships sunk
        if (data.ships[opponent].every((s) => s.hits.every((h) => h))) {
          data.winner = playerId;
        }
      } else {
        this.emitEvent('miss', playerId, { row, col });
      }

      data.currentPlayer = (data.currentPlayer + 1) % 2;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    return this.getData<BattleshipState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<BattleshipState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BattleshipState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      const opponent = this.getPlayers().find((pp) => pp !== p)!;
      let hits = 0;
      for (const ship of data.ships[opponent]) {
        hits += ship.hits.filter((h) => h).length;
      }
      scores[p] = hits;
    }
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as BattleshipState;
    const maskedBoards: Record<string, (string | null)[][]> = {};
    for (const p of this.getPlayers()) {
      if (p === playerId) {
        maskedBoards[p] = data.boards[p];
      } else {
        maskedBoards[p] = data.boards[p].map((row) => row.map(() => null));
      }
    }
    return { ...state, data: { ...data, boards: maskedBoards } };
  }
}
