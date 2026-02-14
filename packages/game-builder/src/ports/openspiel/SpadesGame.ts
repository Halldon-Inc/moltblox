import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}
// Suits: 0=hearts, 1=diamonds, 2=clubs, 3=spades

interface SpadesState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  currentTrick: { player: string; card: Card }[];
  bids: Record<string, number>;
  tricksTaken: Record<string, number>;
  scores: Record<string, number>;
  bags: Record<string, number>;
  currentPlayer: number;
  spadesBroken: boolean;
  biddingPhase: boolean;
  winner: string | null;
  targetScore: number;
}

export class SpadesGame extends BaseGame {
  readonly name = 'Spades';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): SpadesState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    const bids: Record<string, number> = {};
    const tricksTaken: Record<string, number> = {};
    const scores: Record<string, number> = {};
    const bags: Record<string, number> = {};

    for (let i = 0; i < 4; i++) {
      hands[playerIds[i]] = deck.slice(i * 13, (i + 1) * 13);
      bids[playerIds[i]] = -1;
      tricksTaken[playerIds[i]] = 0;
      scores[playerIds[i]] = 0;
      bags[playerIds[i]] = 0;
    }

    return {
      hands,
      currentTrick: [],
      bids,
      tricksTaken,
      scores,
      bags,
      currentPlayer: 0,
      spadesBroken: false,
      biddingPhase: true,
      winner: null,
      targetScore: 500,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SpadesState>();
    const players = this.getPlayers();

    if (data.biddingPhase) {
      if (action.type !== 'bid') return { success: false, error: 'Must place a bid' };
      const bid = Number(action.payload.bid ?? action.payload.amount);
      if (isNaN(bid) || bid < 0 || bid > 13) return { success: false, error: 'Bid must be 0-13' };
      data.bids[playerId] = bid;

      if (players.every((p) => data.bids[p] >= 0)) {
        data.biddingPhase = false;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'play') return { success: false, error: `Unknown action: ${action.type}` };

    const cardIdx = Number(action.payload.cardIndex);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = data.hands[playerId][cardIdx];

    // Must follow suit
    if (data.currentTrick.length > 0) {
      const leadSuit = data.currentTrick[0].card.suit;
      if (card.suit !== leadSuit && data.hands[playerId].some((c) => c.suit === leadSuit)) {
        return { success: false, error: 'Must follow suit' };
      }
    }

    // Cannot lead spades unless broken
    if (data.currentTrick.length === 0 && card.suit === 3 && !data.spadesBroken) {
      if (data.hands[playerId].some((c) => c.suit !== 3)) {
        return { success: false, error: 'Spades not broken yet' };
      }
    }

    if (card.suit === 3) data.spadesBroken = true;
    data.hands[playerId].splice(cardIdx, 1);
    data.currentTrick.push({ player: playerId, card });

    if (data.currentTrick.length === 4) {
      const leadSuit = data.currentTrick[0].card.suit;
      let winnerEntry = data.currentTrick[0];
      let highestSpade = -1;
      let spadeWinner: typeof winnerEntry | null = null;

      for (const entry of data.currentTrick) {
        if (entry.card.suit === 3 && entry.card.rank > highestSpade) {
          highestSpade = entry.card.rank;
          spadeWinner = entry;
        }
        if (entry.card.suit === leadSuit && entry.card.rank > winnerEntry.card.rank) {
          winnerEntry = entry;
        }
      }

      const trickWinner = spadeWinner || winnerEntry;
      data.tricksTaken[trickWinner.player]++;
      data.currentPlayer = players.indexOf(trickWinner.player);
      data.currentTrick = [];

      // Round over
      if (players.every((p) => data.hands[p].length === 0)) {
        for (const p of players) {
          const bid = data.bids[p];
          const taken = data.tricksTaken[p];
          if (bid === 0) {
            data.scores[p] += taken === 0 ? 100 : -100;
          } else if (taken >= bid) {
            data.scores[p] += bid * 10;
            const over = taken - bid;
            data.bags[p] += over;
            data.scores[p] += over;
            if (data.bags[p] >= 10) {
              data.scores[p] -= 100;
              data.bags[p] -= 10;
            }
          } else {
            data.scores[p] -= bid * 10;
          }
        }

        // Check for winner
        const overTarget = players.filter((p) => data.scores[p] >= data.targetScore);
        if (overTarget.length > 0) {
          let best: string | null = null;
          let bestScore = -Infinity;
          for (const p of overTarget) {
            if (data.scores[p] > bestScore) {
              bestScore = data.scores[p];
              best = p;
            }
          }
          data.winner = best;
        } else {
          // New round
          const deck = this.createDeck();
          for (let i = 0; i < 4; i++) {
            data.hands[players[i]] = deck.slice(i * 13, (i + 1) * 13);
            data.bids[players[i]] = -1;
            data.tricksTaken[players[i]] = 0;
          }
          data.spadesBroken = false;
          data.biddingPhase = true;
          data.currentPlayer = 0;
        }
      }
    } else {
      data.currentPlayer = (data.currentPlayer + 1) % 4;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SpadesState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<SpadesState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<SpadesState>().scores };
  }
}
