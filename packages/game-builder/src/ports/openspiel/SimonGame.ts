import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SimonConfig {
  colors?: number;
}

interface SimonState {
  [key: string]: unknown;
  sequence: number[];
  inputIndex: number;
  score: number;
  gameOver: boolean;
  colors: number;
}

export class SimonGame extends BaseGame {
  readonly name = 'Simon';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): SimonState {
    const colors = (this.config as SimonConfig).colors ?? 4;
    const firstColor = Math.floor(Math.random() * colors);
    return {
      sequence: [firstColor],
      inputIndex: 0,
      score: 0,
      gameOver: false,
      colors,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SimonState>();

    if (data.gameOver) {
      return { success: false, error: 'Game is over' };
    }

    if (action.type !== 'press') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const color = Number(action.payload.color);
    if (isNaN(color) || color < 0 || color >= data.colors) {
      return { success: false, error: 'Invalid color' };
    }

    if (color !== data.sequence[data.inputIndex]) {
      data.gameOver = true;
      this.emitEvent('wrong', playerId, { expected: data.sequence[data.inputIndex], got: color });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    data.inputIndex++;

    if (data.inputIndex >= data.sequence.length) {
      data.score++;
      data.sequence.push(Math.floor(Math.random() * data.colors));
      data.inputIndex = 0;
      this.emitEvent('round_complete', playerId, { round: data.score });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SimonState>().gameOver;
  }

  protected determineWinner(): string | null {
    return this.getPlayers()[0];
  }

  protected calculateScores(): Record<string, number> {
    return { [this.getPlayers()[0]]: this.getData<SimonState>().score };
  }
}
