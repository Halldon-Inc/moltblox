import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PigConfig {
  targetScore?: number;
}

interface PigState {
  [key: string]: unknown;
  scores: Record<string, number>;
  turnScore: number;
  currentPlayer: number;
  lastRoll: number | null;
  winner: string | null;
  targetScore: number;
}

export class PigGame extends BaseGame {
  readonly name = 'Pig';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): PigState {
    const scores: Record<string, number> = {};
    for (const p of playerIds) scores[p] = 0;
    const targetScore = (this.config as PigConfig).targetScore ?? 100;

    return { scores, turnScore: 0, currentPlayer: 0, lastRoll: null, winner: null, targetScore };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PigState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'roll') {
      const roll = Math.floor(Math.random() * 6) + 1;
      data.lastRoll = roll;

      if (roll === 1) {
        data.turnScore = 0;
        data.currentPlayer = (data.currentPlayer + 1) % players.length;
        this.emitEvent('bust', playerId, { roll: 1 });
      } else {
        data.turnScore += roll;
        this.emitEvent('roll', playerId, { roll, turnScore: data.turnScore });
      }
    } else if (action.type === 'hold') {
      data.scores[playerId] += data.turnScore;
      this.emitEvent('hold', playerId, { banked: data.turnScore, total: data.scores[playerId] });
      data.turnScore = 0;
      data.lastRoll = null;

      if (data.scores[playerId] >= data.targetScore) {
        data.winner = playerId;
      } else {
        data.currentPlayer = (data.currentPlayer + 1) % players.length;
      }
    } else {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<PigState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<PigState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<PigState>().scores };
  }
}
