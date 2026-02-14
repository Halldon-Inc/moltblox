import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const COLORS = ['red', 'blue', 'green', 'yellow'];

interface SimonState {
  [key: string]: unknown;
  sequence: string[];
  playerIndex: number;
  round: number;
  score: number;
  failed: boolean;
}

export class SimonClassicGame extends BaseGame {
  readonly name = 'Simon Classic';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): SimonState {
    return {
      sequence: [COLORS[Math.floor(Math.random() * 4)]],
      playerIndex: 0,
      round: 1,
      score: 0,
      failed: false,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    if (action.type !== 'press') return { success: false, error: 'Use press action' };
    const d = this.getData<SimonState>();
    const color = action.payload.color as string;
    if (!COLORS.includes(color)) return { success: false, error: 'Invalid color' };

    if (color !== d.sequence[d.playerIndex]) {
      d.failed = true;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    d.playerIndex++;
    if (d.playerIndex >= d.sequence.length) {
      // Completed round
      d.score += d.round * 10;
      d.round++;
      d.sequence.push(COLORS[Math.floor(Math.random() * 4)]);
      d.playerIndex = 0;
      this.emitEvent('round_complete', this.getPlayers()[0], { round: d.round });
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<SimonState>();
    return d.failed || d.round > 20;
  }

  protected determineWinner(): string | null {
    return this.getData<SimonState>().failed ? null : this.getPlayers()[0];
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<SimonState>().score };
  }
}
