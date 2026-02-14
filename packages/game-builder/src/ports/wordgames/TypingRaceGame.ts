import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const TEXTS = [
  'the quick brown fox jumps over the lazy dog near the riverbank',
  'a journey of a thousand miles begins with a single step forward',
  'to be or not to be that is the question we all must answer',
];

interface TypingRaceState {
  [key: string]: unknown;
  words: string[];
  progress: Record<string, number>;
  scores: Record<string, number>;
  totalWords: number;
  winner: string | null;
}

export class TypingRaceGame extends BaseGame {
  readonly name = 'Typing Race';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): TypingRaceState {
    const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
    const words = text.split(' ');
    return {
      words,
      progress: Object.fromEntries(playerIds.map((p) => [p, 0])),
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      totalWords: words.length,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (action.type !== 'type') return { success: false, error: 'Use type action' };
    const d = this.getData<TypingRaceState>();
    const typed = action.payload.word as string;
    const idx = d.progress[playerId];
    if (idx >= d.totalWords) return { success: false, error: 'Already finished' };

    if (typed === d.words[idx]) {
      d.progress[playerId]++;
      d.scores[playerId] += 10;
      if (d.progress[playerId] >= d.totalWords && !d.winner) {
        d.winner = playerId;
        d.scores[playerId] += 50; // finish bonus
      }
    } else {
      d.scores[playerId] = Math.max(0, d.scores[playerId] - 2);
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<TypingRaceState>();
    return d.winner !== null || Object.values(d.progress).every((p) => p >= d.totalWords);
  }

  protected determineWinner(): string | null {
    return this.getData<TypingRaceState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<TypingRaceState>().scores };
  }
}
