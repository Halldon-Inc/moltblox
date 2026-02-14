import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MancalaConfig {
  pitsPerSide?: number;
  stonesPerPit?: number;
}

interface MancalaState {
  [key: string]: unknown;
  pits: number[][];
  stores: number[];
  currentPlayer: number;
  winner: string | null;
  pitsPerSide: number;
}

export class MancalaGame extends BaseGame {
  readonly name = 'Mancala';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): MancalaState {
    const cfg = this.config as MancalaConfig;
    const pitsPerSide = cfg.pitsPerSide ?? 6;
    const stonesPerPit = cfg.stonesPerPit ?? 4;
    return {
      pits: [Array(pitsPerSide).fill(stonesPerPit), Array(pitsPerSide).fill(stonesPerPit)],
      stores: [0, 0],
      currentPlayer: 0,
      winner: null,
      pitsPerSide,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MancalaState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'sow') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const pit = Number(action.payload.pit ?? action.payload.index);
    if (isNaN(pit) || pit < 0 || pit >= data.pitsPerSide) {
      return { success: false, error: 'Invalid pit' };
    }

    const side = data.currentPlayer;
    if (data.pits[side][pit] === 0) {
      return { success: false, error: 'Pit is empty' };
    }

    let stones = data.pits[side][pit];
    data.pits[side][pit] = 0;

    let currentSide = side;
    let currentPit = pit;
    let extraTurn = false;

    while (stones > 0) {
      currentPit++;
      if (currentPit >= data.pitsPerSide) {
        // Reached the store side
        if (currentSide === side) {
          data.stores[side]++;
          stones--;
          if (stones === 0) {
            extraTurn = true;
            break;
          }
        }
        currentSide = (currentSide + 1) % 2;
        currentPit = 0;
      }

      if (stones > 0) {
        data.pits[currentSide][currentPit]++;
        stones--;
      }
    }

    // Capture: if last stone lands in empty pit on own side
    if (!extraTurn && currentSide === side && data.pits[side][currentPit] === 1) {
      const oppositePit = data.pitsPerSide - 1 - currentPit;
      const oppSide = (side + 1) % 2;
      if (data.pits[oppSide][oppositePit] > 0) {
        data.stores[side] += data.pits[oppSide][oppositePit] + 1;
        data.pits[oppSide][oppositePit] = 0;
        data.pits[side][currentPit] = 0;
      }
    }

    // Check if one side is empty
    for (let s = 0; s < 2; s++) {
      if (data.pits[s].every((p) => p === 0)) {
        const other = (s + 1) % 2;
        for (let i = 0; i < data.pitsPerSide; i++) {
          data.stores[other] += data.pits[other][i];
          data.pits[other][i] = 0;
        }
        if (data.stores[0] > data.stores[1]) data.winner = players[0];
        else if (data.stores[1] > data.stores[0]) data.winner = players[1];
        else data.winner = null;
        break;
      }
    }

    if (!extraTurn) {
      data.currentPlayer = (data.currentPlayer + 1) % 2;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MancalaState>();
    return data.winner !== null || data.pits.some((side) => side.every((p) => p === 0));
  }

  protected determineWinner(): string | null {
    const data = this.getData<MancalaState>();
    if (data.winner !== null) return data.winner;
    const players = this.getPlayers();
    if (data.stores[0] > data.stores[1]) return players[0];
    if (data.stores[1] > data.stores[0]) return players[1];
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MancalaState>();
    const players = this.getPlayers();
    return { [players[0]]: data.stores[0], [players[1]]: data.stores[1] };
  }
}
