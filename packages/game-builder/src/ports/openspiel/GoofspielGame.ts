import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface GoofspielState {
  [key: string]: unknown;
  prizeCards: number[];
  hands: Record<string, number[]>;
  currentPrize: number;
  bids: Record<string, number | null>;
  scores: Record<string, number>;
  currentRound: number;
  totalRounds: number;
  winner: string | null;
}

export class GoofspielGame extends BaseGame {
  readonly name = 'Goofspiel';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): GoofspielState {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    // Shuffle prize cards
    const prizeCards = [...cards];
    for (let i = prizeCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prizeCards[i], prizeCards[j]] = [prizeCards[j], prizeCards[i]];
    }
    const hands: Record<string, number[]> = {};
    const bids: Record<string, number | null> = {};
    const scores: Record<string, number> = {};
    for (const p of playerIds) {
      hands[p] = [...cards];
      bids[p] = null;
      scores[p] = 0;
    }
    return {
      prizeCards,
      hands,
      currentPrize: prizeCards[0],
      bids,
      scores,
      currentRound: 0,
      totalRounds: 13,
      winner: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GoofspielState>();

    if (action.type !== 'bid') return { success: false, error: `Unknown action: ${action.type}` };
    if (data.bids[playerId] !== null) return { success: false, error: 'Already bid this round' };

    const bid = Number(action.payload.card ?? action.payload.bid);
    if (isNaN(bid) || !data.hands[playerId].includes(bid)) {
      return { success: false, error: 'Invalid bid card' };
    }

    data.bids[playerId] = bid;
    data.hands[playerId] = data.hands[playerId].filter((c) => c !== bid);

    // Check if all players have bid
    const players = this.getPlayers();
    if (players.every((p) => data.bids[p] !== null)) {
      const bid0 = data.bids[players[0]]!;
      const bid1 = data.bids[players[1]]!;

      if (bid0 > bid1) data.scores[players[0]] += data.currentPrize;
      else if (bid1 > bid0) data.scores[players[1]] += data.currentPrize;
      // Tie: prize is discarded

      data.currentRound++;
      for (const p of players) data.bids[p] = null;

      if (data.currentRound < data.totalRounds) {
        data.currentPrize = data.prizeCards[data.currentRound];
      } else {
        if (data.scores[players[0]] > data.scores[players[1]]) data.winner = players[0];
        else if (data.scores[players[1]] > data.scores[players[0]]) data.winner = players[1];
        else data.winner = null;
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return (
      this.getData<GoofspielState>().currentRound >= this.getData<GoofspielState>().totalRounds
    );
  }

  protected determineWinner(): string | null {
    return this.getData<GoofspielState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<GoofspielState>().scores };
  }
}
