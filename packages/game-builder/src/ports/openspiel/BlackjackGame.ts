import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface BlackjackConfig {
  decks?: number;
}

interface Card {
  suit: string;
  rank: string;
  value: number;
}

interface BlackjackState {
  [key: string]: unknown;
  deck: Card[];
  playerHands: Record<string, Card[][]>;
  dealerHand: Card[];
  bets: Record<string, number[]>;
  activeHandIdx: Record<string, number>;
  standings: Record<string, boolean>;
  dealerDone: boolean;
  results: Record<string, number>;
}

export class BlackjackGame extends BaseGame {
  readonly name = 'Blackjack';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  private createDeck(numDecks: number): Card[] {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    for (let d = 0; d < numDecks; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          let value = parseInt(rank);
          if (isNaN(value)) value = rank === 'A' ? 11 : 10;
          deck.push({ suit, rank, value });
        }
      }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private handValue(hand: Card[]): number {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else total += card.value;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  protected initializeState(playerIds: string[]): BlackjackState {
    const cfg = this.config as BlackjackConfig;
    const deck = this.createDeck(cfg.decks ?? 1);
    const playerHands: Record<string, Card[][]> = {};
    const bets: Record<string, number[]> = {};
    const activeHandIdx: Record<string, number> = {};
    const standings: Record<string, boolean> = {};
    const results: Record<string, number> = {};

    for (const p of playerIds) {
      playerHands[p] = [[deck.pop()!, deck.pop()!]];
      bets[p] = [10];
      activeHandIdx[p] = 0;
      standings[p] = false;
      results[p] = 0;
    }

    const dealerHand = [deck.pop()!, deck.pop()!];

    return {
      deck,
      playerHands,
      dealerHand,
      bets,
      activeHandIdx,
      standings,
      dealerDone: false,
      results,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<BlackjackState>();

    if (data.standings[playerId]) return { success: false, error: 'You have finished your turn' };

    const handIdx = data.activeHandIdx[playerId];
    const hand = data.playerHands[playerId][handIdx];

    switch (action.type) {
      case 'hit': {
        hand.push(data.deck.pop()!);
        if (this.handValue(hand) > 21) {
          // Bust
          if (handIdx + 1 < data.playerHands[playerId].length) {
            data.activeHandIdx[playerId]++;
          } else {
            data.standings[playerId] = true;
          }
        }
        break;
      }
      case 'stand': {
        if (handIdx + 1 < data.playerHands[playerId].length) {
          data.activeHandIdx[playerId]++;
        } else {
          data.standings[playerId] = true;
        }
        break;
      }
      case 'double': {
        if (hand.length !== 2)
          return { success: false, error: 'Can only double on first two cards' };
        data.bets[playerId][handIdx] *= 2;
        hand.push(data.deck.pop()!);
        if (handIdx + 1 < data.playerHands[playerId].length) {
          data.activeHandIdx[playerId]++;
        } else {
          data.standings[playerId] = true;
        }
        break;
      }
      case 'split': {
        if (hand.length !== 2)
          return { success: false, error: 'Can only split on first two cards' };
        if (hand[0].rank !== hand[1].rank)
          return { success: false, error: 'Cards must have same rank to split' };
        const newHand = [hand.pop()!, data.deck.pop()!];
        hand.push(data.deck.pop()!);
        data.playerHands[playerId].push(newHand);
        data.bets[playerId].push(data.bets[playerId][handIdx]);
        break;
      }
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    // Check if all players are done
    const allDone = this.getPlayers().every((p) => data.standings[p]);
    if (allDone && !data.dealerDone) {
      // Dealer plays
      while (this.handValue(data.dealerHand) < 17) {
        data.dealerHand.push(data.deck.pop()!);
      }
      data.dealerDone = true;

      // Resolve bets
      const dealerVal = this.handValue(data.dealerHand);
      const dealerBust = dealerVal > 21;
      for (const p of this.getPlayers()) {
        for (let i = 0; i < data.playerHands[p].length; i++) {
          const pVal = this.handValue(data.playerHands[p][i]);
          if (pVal > 21) {
            data.results[p] -= data.bets[p][i];
          } else if (dealerBust || pVal > dealerVal) {
            data.results[p] += data.bets[p][i];
          } else if (pVal < dealerVal) {
            data.results[p] -= data.bets[p][i];
          }
          // Push: no change
        }
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<BlackjackState>().dealerDone;
  }

  protected determineWinner(): string | null {
    const data = this.getData<BlackjackState>();
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const p of this.getPlayers()) {
      if (data.results[p] > bestScore) {
        bestScore = data.results[p];
        best = p;
      }
    }
    return bestScore > 0 ? best : null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<BlackjackState>().results };
  }
}
