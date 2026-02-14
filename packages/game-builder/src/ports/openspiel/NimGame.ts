import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface NimConfig {
  piles?: number[];
  maxTake?: number;
}

interface NimState {
  [key: string]: unknown;
  piles: number[];
  currentPlayer: number;
  winner: string | null;
  maxTake: number;
}

export class NimGame extends BaseGame {
  readonly name = 'Nim';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): NimState {
    const cfg = this.config as NimConfig;
    return {
      piles: cfg.piles ? [...cfg.piles] : [1, 3, 5, 7],
      currentPlayer: 0,
      winner: null,
      maxTake: cfg.maxTake ?? Infinity,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<NimState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'take') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const pile = Number(action.payload.pile);
    const count = Number(action.payload.count);
    if (isNaN(pile) || isNaN(count) || pile < 0 || pile >= data.piles.length) {
      return { success: false, error: 'Invalid pile' };
    }
    if (count < 1 || count > data.piles[pile] || count > data.maxTake) {
      return { success: false, error: 'Invalid count' };
    }

    data.piles[pile] -= count;

    if (data.piles.every((p) => p === 0)) {
      // Last player to take loses (normal play convention)
      data.winner = players[(data.currentPlayer + 1) % 2];
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<NimState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<NimState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const winner = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === winner ? 1 : 0;
    return scores;
  }
}
