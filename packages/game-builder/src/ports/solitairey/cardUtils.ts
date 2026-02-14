export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
export const BLACK_SUITS: Suit[] = ['clubs', 'spades'];

export interface Card {
  rank: number; // 1=Ace, 2-10, 11=J, 12=Q, 13=K
  suit: Suit;
  faceUp: boolean;
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function isAlternateColor(a: Suit, b: Suit): boolean {
  return isRed(a) !== isRed(b);
}

export function createDeck(faceUp = false): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, faceUp });
    }
  }
  return deck;
}

export function createDoubleDeck(faceUp = false): Card[] {
  return [...createDeck(faceUp), ...createDeck(faceUp)];
}

export function shuffleDeck(deck: Card[]): Card[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}
