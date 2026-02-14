import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Classic snakes and ladders on a 100-square board
const LADDERS: Record<number, number> = {
  2: 38,
  7: 14,
  8: 31,
  15: 26,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  78: 98,
  87: 94,
};

const SNAKES: Record<number, number> = {
  16: 6,
  46: 25,
  49: 11,
  62: 19,
  64: 60,
  74: 53,
  89: 68,
  92: 88,
  95: 75,
  99: 80,
};

interface SnakesPlayerState {
  position: number; // 1-100
}

interface SnakesState {
  [key: string]: unknown;
  players: Record<string, SnakesPlayerState>;
  currentPlayer: number;
  lastDice: number | null;
  winner: string | null;
  gameEnded: boolean;
}

export class SnakesAndLaddersGame extends BaseGame {
  readonly name = 'Snakes and Ladders';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SnakesState {
    const players: Record<string, SnakesPlayerState> = {};
    for (const pid of playerIds) {
      players[pid] = { position: 1 };
    }
    return {
      players,
      currentPlayer: 0,
      lastDice: null,
      winner: null,
      gameEnded: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SnakesState>();
    const playerOrder = this.getPlayers();
    const currentId = playerOrder[data.currentPlayer];

    if (playerId !== currentId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'roll') return { success: false, error: 'Must roll' };

    const dice = Math.floor(Math.random() * 6) + 1;
    data.lastDice = dice;
    const ps = data.players[playerId];
    let newPos = ps.position + dice;

    if (newPos > 100) {
      // Cannot move past 100, stay in place
      data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (newPos === 100) {
      ps.position = 100;
      data.winner = playerId;
      data.gameEnded = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Check ladders
    if (LADDERS[newPos]) {
      newPos = LADDERS[newPos];
      this.emitEvent('ladder', playerId, { from: ps.position + dice, to: newPos });
    }

    // Check snakes
    if (SNAKES[newPos]) {
      newPos = SNAKES[newPos];
      this.emitEvent('snake', playerId, { from: ps.position + dice, to: newPos });
    }

    ps.position = newPos;

    // Extra turn on 6
    if (dice !== 6) {
      data.currentPlayer = (data.currentPlayer + 1) % playerOrder.length;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SnakesState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<SnakesState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SnakesState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.players[p].position;
    }
    return scores;
  }
}
