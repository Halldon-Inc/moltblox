import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import {
  type Card,
  type Rank,
  type Suit,
  createDeck,
  shuffle,
  RANKS,
  SUITS,
} from './cardHelpers.js';

interface Meld {
  rank: Rank;
  count: number;
  wilds: number;
}

interface CanastaState {
  [key: string]: unknown;
  hands: Card[][];
  drawPile: Card[];
  discardPile: Card[];
  melds: Meld[][];
  currentPlayer: number;
  scores: number[];
  winner: string | null;
  phase: string;
}

function createCanastaDeck(): Card[] {
  return [...createDeck(), ...createDeck()];
}

export class CanstaGame extends BaseGame {
  readonly name = 'Canasta';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): CanastaState {
    const deck = shuffle(createCanastaDeck());
    const n = playerIds.length;
    const cpe = n <= 2 ? 15 : 13;
    const hands: Card[][] = [];
    for (let i = 0; i < n; i++) hands.push(deck.splice(0, cpe));
    return {
      hands,
      drawPile: deck,
      discardPile: [deck.pop()!],
      melds: Array.from({ length: n }, () => []),
      currentPlayer: 0,
      scores: Array(n).fill(0),
      winner: null,
      phase: 'draw',
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CanastaState>();
    const players = this.getPlayers();
    const pi = players.indexOf(playerId);
    if (pi !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (action.type === 'draw') {
      if (data.phase !== 'draw') return { success: false, error: 'Not draw phase' };
      if (data.drawPile.length === 0) {
        this.endRound(data, players);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      data.hands[pi].push(data.drawPile.pop()!);
      data.phase = 'play';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'meld') {
      if (data.phase !== 'play') return { success: false, error: 'Not play phase' };
      const cardKeys = action.payload.cards as string[];
      if (!Array.isArray(cardKeys) || cardKeys.length < 3)
        return { success: false, error: 'Need 3+ cards' };
      const cards: Card[] = [];
      for (const k of cardKeys) {
        const [r, s] = k.split('_');
        const ci = data.hands[pi].findIndex((c) => c.rank === r && c.suit === s);
        if (ci === -1) return { success: false, error: `Card not in hand: ${k}` };
        cards.push(data.hands[pi].splice(ci, 1)[0]);
      }
      const naturals = cards.filter((c) => c.rank !== '2');
      if (naturals.length === 0) {
        data.hands[pi].push(...cards);
        return { success: false, error: 'Need natural cards' };
      }
      const meldRank = naturals[0].rank;
      const existing = data.melds[pi].find((m) => m.rank === meldRank);
      if (existing) {
        existing.count += naturals.length;
        existing.wilds += cards.length - naturals.length;
      } else {
        data.melds[pi].push({
          rank: meldRank,
          count: naturals.length,
          wilds: cards.length - naturals.length,
        });
      }
      if (data.hands[pi].length === 0) {
        const hasCanasta = data.melds[pi].some((m) => m.count + m.wilds >= 7);
        if (hasCanasta) this.endRound(data, players);
        else {
          data.hands[pi].push(...cards);
          if (existing) {
            existing.count -= naturals.length;
            existing.wilds -= cards.length - naturals.length;
          } else data.melds[pi].pop();
          return { success: false, error: 'Need canasta to go out' };
        }
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'discard') {
      if (data.phase !== 'play') return { success: false, error: 'Not play phase' };
      const [r, s] = (action.payload.card as string).split('_');
      const ci = data.hands[pi].findIndex((c) => c.rank === r && c.suit === s);
      if (ci === -1) return { success: false, error: 'Card not in hand' };
      data.discardPile.push(data.hands[pi].splice(ci, 1)[0]);
      if (data.hands[pi].length === 0) {
        const hasCanasta = data.melds[pi].some((m) => m.count + m.wilds >= 7);
        if (hasCanasta) this.endRound(data, players);
        else {
          data.hands[pi].push(data.discardPile.pop()!);
          return { success: false, error: 'Need canasta' };
        }
      } else {
        data.currentPlayer = (pi + 1) % players.length;
        data.phase = 'draw';
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  private endRound(data: CanastaState, players: string[]): void {
    for (let i = 0; i < players.length; i++) {
      let s = 0;
      for (const m of data.melds[i]) {
        s += (m.count + m.wilds) * 10;
        if (m.count + m.wilds >= 7) s += 300;
      }
      for (const c of data.hands[i]) s -= 10;
      if (data.hands[i].length === 0) s += 100;
      data.scores[i] += s;
    }
    for (let i = 0; i < players.length; i++) {
      if (data.scores[i] >= 5000) {
        data.winner = players[i];
        return;
      }
    }
    const deck = shuffle(createCanastaDeck());
    const n = players.length;
    const cpe = n <= 2 ? 15 : 13;
    for (let i = 0; i < n; i++) data.hands[i] = deck.splice(0, cpe);
    data.drawPile = deck;
    data.discardPile = [data.drawPile.pop()!];
    data.melds = Array.from({ length: n }, () => []);
    data.currentPlayer = (data.currentPlayer + 1) % n;
    data.phase = 'draw';
  }

  protected checkGameOver(): boolean {
    return this.getData<CanastaState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<CanastaState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const d = this.getData<CanastaState>();
    const s: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) s[p[i]] = d.scores[i];
    return s;
  }
}
