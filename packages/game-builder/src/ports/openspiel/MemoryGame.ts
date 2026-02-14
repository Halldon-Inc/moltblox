import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MemoryGameConfig {
  pairs?: number;
}

interface MemoryState {
  [key: string]: unknown;
  cards: number[];
  revealed: boolean[];
  matched: boolean[];
  firstFlip: number | null;
  currentPlayer: number;
  scores: Record<string, number>;
  winner: string | null;
}

export class MemoryGame extends BaseGame {
  readonly name = 'Memory';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): MemoryState {
    const pairs = (this.config as MemoryGameConfig).pairs ?? 8;
    const values: number[] = [];
    for (let i = 0; i < pairs; i++) {
      values.push(i, i);
    }
    // Shuffle
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    const scores: Record<string, number> = {};
    for (const p of playerIds) scores[p] = 0;

    return {
      cards: values,
      revealed: Array(values.length).fill(false),
      matched: Array(values.length).fill(false),
      firstFlip: null,
      currentPlayer: 0,
      scores,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MemoryState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (action.type !== 'flip') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const index = Number(action.payload.index);
    if (isNaN(index) || index < 0 || index >= data.cards.length) {
      return { success: false, error: 'Invalid card index' };
    }
    if (data.matched[index] || data.revealed[index]) {
      return { success: false, error: 'Card already revealed or matched' };
    }

    data.revealed[index] = true;

    if (data.firstFlip === null) {
      data.firstFlip = index;
    } else {
      const firstIdx = data.firstFlip;
      if (data.cards[firstIdx] === data.cards[index]) {
        data.matched[firstIdx] = true;
        data.matched[index] = true;
        data.scores[playerId]++;
        this.emitEvent('match', playerId, { card: data.cards[index] });
      } else {
        data.revealed[firstIdx] = false;
        data.revealed[index] = false;
        data.currentPlayer = (data.currentPlayer + 1) % players.length;
      }
      data.firstFlip = null;
    }

    if (data.matched.every((m) => m)) {
      let best: string | null = null;
      let bestScore = -1;
      for (const p of players) {
        if (data.scores[p] > bestScore) {
          bestScore = data.scores[p];
          best = p;
        }
      }
      data.winner = best;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<MemoryState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<MemoryState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<MemoryState>().scores };
  }
}
