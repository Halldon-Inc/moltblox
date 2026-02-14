import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface WildWestDuelConfig {
  rounds?: number;
}

interface WildWestDuelState {
  [key: string]: unknown;
  round: number;
  maxRounds: number;
  drawTime: number;
  actions: Record<string, { type: string; time: number } | null>;
  scores: Record<string, number>;
  roundResults: { winner: string | null; draw: boolean }[];
  winner: string | null;
  phase: string;
}

export class WildWestDuelGame extends BaseGame {
  readonly name = 'Wild West Duel';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): WildWestDuelState {
    const maxRounds = (this.config as WildWestDuelConfig).rounds ?? 5;
    const scores: Record<string, number> = {};
    const actions: Record<string, { type: string; time: number } | null> = {};
    for (const p of playerIds) {
      scores[p] = 0;
      actions[p] = null;
    }

    return {
      round: 1,
      maxRounds,
      drawTime: Math.floor(Math.random() * 3000) + 2000,
      actions,
      scores,
      roundResults: [],
      winner: null,
      phase: 'waiting',
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<WildWestDuelState>();
    const players = this.getPlayers();

    if (action.type === 'ready') {
      if (data.phase === 'waiting') {
        data.phase = 'draw';
        data.drawTime = Math.floor(Math.random() * 3000) + 2000;
        for (const p of players) data.actions[p] = null;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'shoot') return { success: false, error: `Unknown action: ${action.type}` };
    if (data.phase !== 'draw') return { success: false, error: 'Not in draw phase' };
    if (data.actions[playerId] !== null)
      return { success: false, error: 'Already acted this round' };

    const reactionTime = Number(action.payload.time);
    if (isNaN(reactionTime) || reactionTime < 0)
      return { success: false, error: 'Invalid reaction time' };

    const tooEarly = reactionTime < data.drawTime;
    data.actions[playerId] = { type: tooEarly ? 'foul' : 'shoot', time: reactionTime };

    if (players.every((p) => data.actions[p] !== null)) {
      const p1 = players[0];
      const p2 = players[1];
      const a1 = data.actions[p1]!;
      const a2 = data.actions[p2]!;

      let roundWinner: string | null = null;
      let isDraw = false;

      if (a1.type === 'foul' && a2.type === 'foul') {
        isDraw = true;
      } else if (a1.type === 'foul') {
        roundWinner = p2;
      } else if (a2.type === 'foul') {
        roundWinner = p1;
      } else {
        if (a1.time < a2.time) roundWinner = p1;
        else if (a2.time < a1.time) roundWinner = p2;
        else isDraw = true;
      }

      if (roundWinner) data.scores[roundWinner]++;

      data.roundResults.push({ winner: roundWinner, draw: isDraw });

      if (data.round >= data.maxRounds) {
        let best: string | null = null;
        let bestScore = -1;
        for (const p of players) {
          if (data.scores[p] > bestScore) {
            bestScore = data.scores[p];
            best = p;
          }
        }
        data.winner = best;
      } else {
        data.round++;
        data.phase = 'waiting';
        for (const p of players) data.actions[p] = null;
      }

      this.emitEvent('round_end', undefined, {
        round: data.round,
        winner: roundWinner,
        draw: isDraw,
      });
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<WildWestDuelState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<WildWestDuelState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<WildWestDuelState>().scores };
  }
}
