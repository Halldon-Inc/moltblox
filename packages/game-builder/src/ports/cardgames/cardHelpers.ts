/**
 * Shared card game helpers.
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function createDoubleDeck(): Card[] {
  return [...createDeck(), ...createDeck()];
}

export function createDoubleDeckWithJokers(): Card[] {
  const deck = createDoubleDeck();
  deck.push({ rank: 'A', suit: 'hearts' }); // Joker represented as special
  deck.push({ rank: 'A', suit: 'diamonds' }); // Joker 2
  // Actually, jokers need a different representation
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function deal(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number,
): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < numPlayers; p++) {
      if (idx < deck.length) {
        hands[p].push(deck[idx++]);
      }
    }
  }
  return { hands, remaining: deck.slice(idx) };
}

export function rankValue(rank: Rank): number {
  const vals: Record<Rank, number> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  return vals[rank];
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function removeCard(hand: Card[], card: Card): boolean {
  const idx = hand.findIndex((c) => cardEquals(c, card));
  if (idx === -1) return false;
  hand.splice(idx, 1);
  return true;
}

export function cardKey(card: Card): string {
  return `${card.rank}_${card.suit}`;
}

export function parseCard(key: string): Card | null {
  const parts = key.split('_');
  if (parts.length !== 2) return null;
  const rank = parts[0] as Rank;
  const suit = parts[1] as Suit;
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) return null;
  return { rank, suit };
}

export function isSameSuit(cards: Card[]): boolean {
  if (cards.length === 0) return true;
  return cards.every((c) => c.suit === cards[0].suit);
}

export function highestCard(cards: Card[], trumpSuit?: Suit, leadSuit?: Suit): number {
  let best = 0;
  for (let i = 1; i < cards.length; i++) {
    if (compareCards(cards[i], cards[best], trumpSuit, leadSuit) > 0) {
      best = i;
    }
  }
  return best;
}

export function compareCards(a: Card, b: Card, trumpSuit?: Suit, leadSuit?: Suit): number {
  const aIsTrump = trumpSuit && a.suit === trumpSuit;
  const bIsTrump = trumpSuit && b.suit === trumpSuit;
  const aIsLead = leadSuit && a.suit === leadSuit;
  const bIsLead = leadSuit && b.suit === leadSuit;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;
  if (aIsTrump && bIsTrump) return rankValue(a.rank) - rankValue(b.rank);

  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;

  return rankValue(a.rank) - rankValue(b.rank);
}
