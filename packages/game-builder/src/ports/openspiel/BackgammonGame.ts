import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface BackgammonState {
  [key: string]: unknown;
  points: { owner: string | null; count: number }[];
  bar: number[];
  borneOff: number[];
  currentPlayer: number;
  dice: number[];
  movesRemaining: number[];
  winner: string | null;
  needsRoll: boolean;
}

export class BackgammonGame extends BaseGame {
  readonly name = 'Backgammon';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): BackgammonState {
    const points: { owner: string | null; count: number }[] = Array(24)
      .fill(null)
      .map(() => ({ owner: null, count: 0 }));
    // Standard starting position
    // Player 0 moves from high to low (bearing off at 0), Player 1 from low to high (bearing off at 23+)
    const setup: [number, string, number][] = [
      [0, playerIds[1], 2],
      [5, playerIds[0], 5],
      [7, playerIds[0], 3],
      [11, playerIds[1], 5],
      [12, playerIds[0], 5],
      [16, playerIds[1], 3],
      [18, playerIds[1], 5],
      [23, playerIds[0], 2],
    ];
    for (const [idx, owner, count] of setup) {
      points[idx] = { owner, count };
    }

    return {
      points,
      bar: [0, 0],
      borneOff: [0, 0],
      currentPlayer: 0,
      dice: [],
      movesRemaining: [],
      winner: null,
      needsRoll: true,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BackgammonState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'roll') {
      if (!data.needsRoll) return { success: false, error: 'Already rolled' };
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      data.dice = [d1, d2];
      if (d1 === d2) {
        data.movesRemaining = [d1, d1, d1, d1];
      } else {
        data.movesRemaining = [d1, d2];
      }
      data.needsRoll = false;

      // Check if player can move
      if (!this.canMove(data, data.currentPlayer, players)) {
        data.movesRemaining = [];
        data.currentPlayer = (data.currentPlayer + 1) % 2;
        data.needsRoll = true;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'move') {
      if (data.needsRoll) return { success: false, error: 'Must roll first' };

      const from = Number(action.payload.from); // -1 for bar
      const die = Number(action.payload.die);

      if (isNaN(from) || isNaN(die)) return { success: false, error: 'Invalid move parameters' };
      if (!data.movesRemaining.includes(die))
        return { success: false, error: 'Die value not available' };

      const pIdx = data.currentPlayer;
      const direction = pIdx === 0 ? -1 : 1;

      // Must move from bar first
      if (data.bar[pIdx] > 0 && from !== -1) {
        return { success: false, error: 'Must move from bar first' };
      }

      let to: number;
      if (from === -1) {
        // From bar
        to = pIdx === 0 ? 24 - die : die - 1;
      } else {
        to = from + die * direction;
      }

      // Bearing off
      const isBearingOff = (pIdx === 0 && to < 0) || (pIdx === 1 && to > 23);
      if (isBearingOff) {
        if (!this.canBearOff(data, pIdx, players)) {
          return { success: false, error: 'Cannot bear off yet' };
        }
        // For exact or higher die when bearing off
        if (from === -1) return { success: false, error: 'Cannot bear off from bar' };

        if (pIdx === 0 && to < 0) {
          // Check if exact or highest
          if (from !== die - 1) {
            // Not exact: check no pieces behind
            let hasBehind = false;
            for (let i = from + 1; i < 6; i++) {
              if (data.points[i].owner === players[pIdx] && data.points[i].count > 0)
                hasBehind = true;
            }
            if (hasBehind)
              return { success: false, error: 'Must use exact die or move highest piece' };
          }
        }
        if (pIdx === 1 && to > 23) {
          if (from !== 24 - die) {
            let hasBehind = false;
            for (let i = from - 1; i >= 18; i--) {
              if (data.points[i].owner === players[pIdx] && data.points[i].count > 0)
                hasBehind = true;
            }
            if (hasBehind)
              return { success: false, error: 'Must use exact die or move highest piece' };
          }
        }

        // Remove from source
        if (from >= 0) {
          data.points[from].count--;
          if (data.points[from].count === 0) data.points[from].owner = null;
        }
        data.borneOff[pIdx]++;
      } else {
        if (to < 0 || to > 23) return { success: false, error: 'Invalid destination' };

        const dest = data.points[to];
        const opponent = (pIdx + 1) % 2;

        if (dest.owner === players[opponent] && dest.count > 1) {
          return { success: false, error: 'Point is blocked' };
        }

        // Hit
        if (dest.owner === players[opponent] && dest.count === 1) {
          data.bar[opponent]++;
          dest.count = 0;
          dest.owner = null;
        }

        // Remove from source
        if (from === -1) {
          data.bar[pIdx]--;
        } else {
          data.points[from].count--;
          if (data.points[from].count === 0) data.points[from].owner = null;
        }

        // Place at destination
        dest.owner = players[pIdx];
        dest.count++;
      }

      // Remove used die
      const dieIdx = data.movesRemaining.indexOf(die);
      data.movesRemaining.splice(dieIdx, 1);

      // Check win
      if (data.borneOff[pIdx] >= 15) {
        data.winner = players[pIdx];
      }

      // If no moves remaining, switch turns
      if (data.movesRemaining.length === 0 || !this.canMove(data, pIdx, players)) {
        data.movesRemaining = [];
        data.currentPlayer = (data.currentPlayer + 1) % 2;
        data.needsRoll = true;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private canBearOff(data: BackgammonState, pIdx: number, players: string[]): boolean {
    if (data.bar[pIdx] > 0) return false;
    const homeStart = pIdx === 0 ? 0 : 18;
    const homeEnd = pIdx === 0 ? 5 : 23;
    for (let i = 0; i < 24; i++) {
      if (i >= homeStart && i <= homeEnd) continue;
      if (data.points[i].owner === players[pIdx] && data.points[i].count > 0) return false;
    }
    return true;
  }

  private canMove(data: BackgammonState, pIdx: number, players: string[]): boolean {
    if (data.movesRemaining.length === 0) return false;
    const direction = pIdx === 0 ? -1 : 1;
    const opponent = (pIdx + 1) % 2;

    for (const die of data.movesRemaining) {
      if (data.bar[pIdx] > 0) {
        const to = pIdx === 0 ? 24 - die : die - 1;
        const dest = data.points[to];
        if (!dest.owner || dest.owner === players[pIdx] || dest.count <= 1) return true;
      } else {
        for (let i = 0; i < 24; i++) {
          if (data.points[i].owner !== players[pIdx] || data.points[i].count === 0) continue;
          const to = i + die * direction;
          if ((pIdx === 0 && to < 0) || (pIdx === 1 && to > 23)) {
            if (this.canBearOff(data, pIdx, players)) return true;
            continue;
          }
          if (to >= 0 && to <= 23) {
            const dest = data.points[to];
            if (!dest.owner || dest.owner === players[pIdx] || dest.count <= 1) return true;
          }
        }
      }
    }
    return false;
  }

  protected checkGameOver(): boolean {
    return this.getData<BackgammonState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<BackgammonState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<BackgammonState>();
    const players = this.getPlayers();
    return { [players[0]]: data.borneOff[0], [players[1]]: data.borneOff[1] };
  }
}
