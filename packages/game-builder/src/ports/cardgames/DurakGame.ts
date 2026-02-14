import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Suit, type Rank, shuffle, rankValue, SUITS } from './cardHelpers.js';

// Durak uses a 36-card deck (6 through A)
const DURAK_RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDurakDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of DURAK_RANKS) deck.push({ rank, suit });
  return deck;
}

interface Attack {
  attack: Card;
  defense: Card | null;
}

interface DurakState {
  [key: string]: unknown;
  hands: Card[][];
  drawPile: Card[];
  trumpSuit: Suit;
  trumpCard: Card;
  currentAttacker: number;
  currentDefender: number;
  attacks: Attack[];
  phase: string; // 'attack' | 'defend' | 'done'
  scores: number[];
  winner: string | null;
  loser: string | null;
  passedPlayers: boolean[];
}

export class DurakGame extends BaseGame {
  readonly name = 'Durak';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): DurakState {
    const n = playerIds.length;
    const deck = shuffle(createDurakDeck());
    const hands: Card[][] = [];
    for (let i = 0; i < n; i++) hands.push(deck.splice(0, 6));
    const trumpCard = deck[deck.length - 1] || hands[0][0];

    return {
      hands,
      drawPile: deck,
      trumpSuit: trumpCard.suit,
      trumpCard,
      currentAttacker: 0,
      currentDefender: 1,
      attacks: [],
      phase: 'attack',
      scores: Array(n).fill(0),
      winner: null,
      loser: null,
      passedPlayers: Array(n).fill(false),
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DurakState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    const n = players.length;

    if (data.phase === 'attack') {
      if (action.type === 'attack') {
        if (pi !== data.currentAttacker) return { success: false, error: 'Not the attacker' };
        const [r, s] = (action.payload.card as string).split('_');
        const card: Card = { rank: r as Rank, suit: s as Suit };
        const hand = data.hands[pi];
        const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
        if (idx === -1) return { success: false, error: 'Card not in hand' };

        // Attack card must match a rank already on the table (if any attacks exist)
        if (data.attacks.length > 0) {
          const tableRanks = new Set<Rank>();
          for (const a of data.attacks) {
            tableRanks.add(a.attack.rank);
            if (a.defense) tableRanks.add(a.defense.rank);
          }
          if (!tableRanks.has(card.rank))
            return { success: false, error: 'Card rank must match table' };
        }

        // Max 6 attacks (or defender hand size)
        if (data.attacks.length >= Math.min(6, data.hands[data.currentDefender].length)) {
          return { success: false, error: 'Too many attacks' };
        }

        hand.splice(idx, 1);
        data.attacks.push({ attack: card, defense: null });
        data.phase = 'defend';

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'done') {
        // Attacker is done attacking
        if (pi !== data.currentAttacker) return { success: false, error: 'Not attacker' };
        // All attacks defended?
        const allDefended = data.attacks.every((a) => a.defense !== null);
        if (allDefended) {
          // Successful defense: discard table
          data.attacks = [];
          this.drawCards(data, n);
          data.currentAttacker = data.currentDefender;
          data.currentDefender = (data.currentDefender + 1) % n;
          // Skip players with no cards
          while (
            data.hands[data.currentDefender].length === 0 &&
            data.currentDefender !== data.currentAttacker
          ) {
            data.currentDefender = (data.currentDefender + 1) % n;
          }
          data.phase = 'attack';
        }

        this.checkEnd(data, players);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      return { success: false, error: 'Must attack or done' };
    }

    if (data.phase === 'defend') {
      if (pi !== data.currentDefender) return { success: false, error: 'Not defender' };

      if (action.type === 'take') {
        // Defender takes all cards
        for (const a of data.attacks) {
          data.hands[pi].push(a.attack);
          if (a.defense) data.hands[pi].push(a.defense);
        }
        data.attacks = [];
        this.drawCards(data, n);
        // Defender loses turn
        data.currentAttacker = (data.currentDefender + 1) % n;
        data.currentDefender = (data.currentAttacker + 1) % n;
        while (
          data.hands[data.currentDefender].length === 0 &&
          data.currentDefender !== data.currentAttacker
        ) {
          data.currentDefender = (data.currentDefender + 1) % n;
        }
        data.phase = 'attack';
        this.checkEnd(data, players);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type !== 'defend') return { success: false, error: 'Must defend or take' };

      const [r, s] = (action.payload.card as string).split('_');
      const card: Card = { rank: r as Rank, suit: s as Suit };
      const attackIdx = Number(action.payload.attackIndex ?? 0);

      const hand = data.hands[pi];
      const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
      if (idx === -1) return { success: false, error: 'Card not in hand' };

      if (attackIdx >= data.attacks.length || data.attacks[attackIdx].defense !== null) {
        return { success: false, error: 'Invalid attack to defend' };
      }

      const attackCard = data.attacks[attackIdx].attack;
      // Must beat: same suit higher rank, or trump
      if (card.suit === attackCard.suit) {
        if (rankValue(card.rank) <= rankValue(attackCard.rank))
          return { success: false, error: 'Card too low' };
      } else if (card.suit === data.trumpSuit) {
        // Trump beats non-trump
        if (
          attackCard.suit === data.trumpSuit &&
          rankValue(card.rank) <= rankValue(attackCard.rank)
        ) {
          return { success: false, error: 'Trump too low' };
        }
      } else {
        return { success: false, error: 'Must play same suit or trump' };
      }

      hand.splice(idx, 1);
      data.attacks[attackIdx].defense = card;

      // If all attacks defended, back to attack phase
      if (data.attacks.every((a) => a.defense !== null)) {
        data.phase = 'attack';
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid phase' };
  }

  private drawCards(data: DurakState, n: number): void {
    // Each player draws to 6 cards
    for (let i = 0; i < n; i++) {
      while (data.hands[i].length < 6 && data.drawPile.length > 0) {
        data.hands[i].push(data.drawPile.pop()!);
      }
    }
  }

  private checkEnd(data: DurakState, players: string[]): void {
    if (data.drawPile.length > 0) return;
    const n = players.length;
    let playersWithCards = 0;
    let lastPlayer = -1;
    for (let i = 0; i < n; i++) {
      if (data.hands[i].length > 0) {
        playersWithCards++;
        lastPlayer = i;
      }
    }
    if (playersWithCards <= 1) {
      if (playersWithCards === 1) {
        data.loser = players[lastPlayer];
        // Winner is the first player who ran out
        for (let i = 0; i < n; i++) {
          if (data.hands[i].length === 0) {
            data.winner = players[i];
            break;
          }
        }
      } else {
        data.winner = players[0]; // Draw
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<DurakState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<DurakState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<DurakState>();
    const sc: Record<string, number> = {};
    const p = this.getPlayers();
    for (const pl of p) sc[pl] = pl === d.loser ? -1 : pl === d.winner ? 1 : 0;
    return sc;
  }
}
