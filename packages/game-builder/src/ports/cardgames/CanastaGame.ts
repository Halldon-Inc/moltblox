import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface CanastaConfig {
  targetScore?: number;
}

interface Card {
  rank: number; // 1=Ace, 2-13, 14=Joker(black), 15=Joker(red)
  suit: number; // 0-3 for regular, -1 for jokers
}

interface Meld {
  rank: number;
  cards: Card[];
  isCanasta: boolean;
}

interface CanastaState {
  [key: string]: unknown;
  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  melds: Record<string, Meld[]>;
  scores: Record<string, number>;
  currentPlayer: number;
  hasDrawn: boolean;
  phase: string; // 'play' | 'done'
  winner: string | null;
  frozenPile: boolean;
  targetScore: number;
}

function isWild(card: Card): boolean {
  return card.rank === 2 || card.rank === 14 || card.rank === 15;
}

function isBlackThree(card: Card): boolean {
  return card.rank === 3 && (card.suit === 0 || card.suit === 3);
}

function cardPoints(card: Card): number {
  if (card.rank === 14 || card.rank === 15) return 50; // Jokers
  if (card.rank === 2) return 20; // Deuces
  if (card.rank === 1) return 20; // Aces
  if (card.rank >= 8) return 10; // 8-K
  if (card.rank === 3 && (card.suit === 2 || card.suit === 1)) return 100; // Red threes
  return 5; // 4-7, black 3s
}

function createCanastaDeck(): Card[] {
  const deck: Card[] = [];
  // Two standard decks + 4 jokers
  for (let d = 0; d < 2; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ rank, suit });
      }
    }
    deck.push({ rank: 14, suit: -1 });
    deck.push({ rank: 15, suit: -1 });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Canasta: 2-4 player rummy-style card game with 2 decks plus jokers.
 * Form melds of 3+ cards of the same rank. A canasta is a meld of 7+.
 * Wild cards (2s, Jokers) substitute for any rank.
 * Actions: draw, meld, discard, pick_pile.
 */
export class CanastaGame extends BaseGame {
  readonly name = 'Canasta';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): CanastaState {
    const cfg = this.config as CanastaConfig;
    const deck = createCanastaDeck();
    const hands: Record<string, Card[]> = {};
    const cardsPerHand = playerIds.length <= 2 ? 15 : 13;
    for (const pid of playerIds) {
      hands[pid] = [];
      for (let i = 0; i < cardsPerHand; i++) hands[pid].push(deck.pop()!);
    }
    const firstDiscard = deck.pop()!;
    const scores: Record<string, number> = {};
    const melds: Record<string, Meld[]> = {};
    for (const pid of playerIds) {
      scores[pid] = 0;
      melds[pid] = [];
    }
    return {
      deck,
      discardPile: [firstDiscard],
      hands,
      melds,
      scores,
      currentPlayer: 0,
      hasDrawn: false,
      phase: 'play',
      winner: null,
      frozenPile: isWild(firstDiscard) || isBlackThree(firstDiscard),
      targetScore: cfg.targetScore ?? 5000,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CanastaState>();
    const players = this.getPlayers();
    const pIdx = players.indexOf(playerId);

    if (pIdx !== data.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'draw') {
      if (data.hasDrawn) {
        return { success: false, error: 'Already drew this turn' };
      }
      if (data.deck.length === 0) {
        // Reshuffle discard pile
        if (data.discardPile.length <= 1) {
          return { success: false, error: 'No cards to draw' };
        }
        const top = data.discardPile.pop()!;
        data.deck = data.discardPile;
        data.discardPile = [top];
        for (let i = data.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data.deck[i], data.deck[j]] = [data.deck[j], data.deck[i]];
        }
      }
      data.hands[playerId].push(data.deck.pop()!);
      data.hasDrawn = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'pick_pile') {
      if (data.hasDrawn) {
        return { success: false, error: 'Already drew this turn' };
      }
      if (data.discardPile.length === 0) {
        return { success: false, error: 'Discard pile is empty' };
      }
      const topCard = data.discardPile[data.discardPile.length - 1];
      if (data.frozenPile) {
        // Must have a natural pair matching top card
        const naturals = data.hands[playerId].filter((c) => c.rank === topCard.rank && !isWild(c));
        if (naturals.length < 2) {
          return { success: false, error: 'Need a natural pair to pick up frozen pile' };
        }
      }
      // Pick up entire discard pile
      data.hands[playerId].push(...data.discardPile);
      data.discardPile = [];
      data.frozenPile = false;
      data.hasDrawn = true;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'meld') {
      if (!data.hasDrawn) {
        return { success: false, error: 'Must draw before melding' };
      }
      const cardIndices = action.payload.cardIndices as number[];
      if (!Array.isArray(cardIndices) || cardIndices.length < 3) {
        return { success: false, error: 'Meld requires at least 3 cards' };
      }
      const hand = data.hands[playerId];
      // Validate indices
      const sortedIndices = [...cardIndices].sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        if (idx < 0 || idx >= hand.length) {
          return { success: false, error: 'Invalid card index' };
        }
      }
      const meldCards = cardIndices.map((i) => hand[i]);
      const naturals = meldCards.filter((c) => !isWild(c));
      const wilds = meldCards.filter((c) => isWild(c));

      if (naturals.length === 0) {
        return { success: false, error: 'Meld must have at least one natural card' };
      }
      if (wilds.length > naturals.length) {
        return {
          success: false,
          error: 'Cannot have more wild cards than natural cards in a meld',
        };
      }

      // All naturals must be the same rank
      const meldRank = naturals[0].rank;
      if (!naturals.every((c) => c.rank === meldRank)) {
        return { success: false, error: 'All natural cards must be the same rank' };
      }
      if (meldRank === 3) {
        return { success: false, error: 'Cannot meld 3s' };
      }

      // Check if extending existing meld
      const existing = data.melds[playerId].find((m) => m.rank === meldRank);
      if (existing) {
        existing.cards.push(...meldCards);
        existing.isCanasta = existing.cards.length >= 7;
      } else {
        data.melds[playerId].push({
          rank: meldRank,
          cards: meldCards,
          isCanasta: meldCards.length >= 7,
        });
      }

      // Remove cards from hand (remove from highest index first)
      for (const idx of sortedIndices) {
        hand.splice(idx, 1);
      }

      this.emitEvent('meld_placed', playerId, { rank: meldRank, count: meldCards.length });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'discard') {
      if (!data.hasDrawn) {
        return { success: false, error: 'Must draw before discarding' };
      }
      const cardIdx = Number(action.payload.cardIndex);
      const hand = data.hands[playerId];
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= hand.length) {
        return { success: false, error: 'Invalid card index' };
      }
      const card = hand.splice(cardIdx, 1)[0];
      data.discardPile.push(card);

      // Freeze pile if wild or black 3
      if (isWild(card) || isBlackThree(card)) {
        data.frozenPile = true;
      }

      // Check if player went out
      if (hand.length === 0) {
        // Must have at least one canasta to go out
        const hasCanasta = data.melds[playerId].some((m) => m.isCanasta);
        if (hasCanasta) {
          this.scoreRound(data, players, playerId);
          data.phase = 'done';
        } else {
          // Cannot go out without a canasta; put card back
          hand.push(card);
          data.discardPile.pop();
          this.setData(data);
          return { success: false, error: 'Must have at least one canasta to go out' };
        }
      }

      data.hasDrawn = false;
      data.currentPlayer = (data.currentPlayer + 1) % players.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private scoreRound(data: CanastaState, players: string[], goOutPlayer: string): void {
    for (const p of players) {
      let score = 0;
      // Meld points
      for (const meld of data.melds[p]) {
        for (const card of meld.cards) score += cardPoints(card);
        if (meld.isCanasta) {
          const allNatural = meld.cards.every((c) => !isWild(c));
          score += allNatural ? 500 : 300;
        }
      }
      // Subtract remaining hand cards
      for (const card of data.hands[p]) {
        score -= cardPoints(card);
      }
      // Going out bonus
      if (p === goOutPlayer) score += 100;
      data.scores[p] += score;
    }
    // Check winner
    for (const p of players) {
      if (data.scores[p] >= data.targetScore) {
        data.winner = p;
        break;
      }
    }
    if (!data.winner) {
      // Highest score wins the round
      let best: string | null = null;
      let bestScore = -Infinity;
      for (const p of players) {
        if (data.scores[p] > bestScore) {
          bestScore = data.scores[p];
          best = p;
        }
      }
      data.winner = best;
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CanastaState>();
    return data.winner !== null || data.phase === 'done';
  }

  protected determineWinner(): string | null {
    return this.getData<CanastaState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<CanastaState>().scores };
  }
}
