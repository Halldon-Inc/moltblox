import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';
import { type Card, type Rank, createDeck, shuffle, RANKS } from './cardHelpers.js';

interface CribbageState {
  [key: string]: unknown;
  hands: Card[][];
  crib: Card[];
  starterCard: Card | null;
  deck: Card[];
  currentPlayer: number;
  dealer: number;
  scores: number[];
  phase: string; // 'discard' | 'play'
  playPile: Card[];
  playCount: number;
  goCount: number;
  winner: string | null;
  lastPegPlayer: number;
}

function cribVal(rank: string): number {
  if (rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export class CribbageGame extends BaseGame {
  readonly name = 'Cribbage';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CribbageState {
    const deck = shuffle(createDeck());
    return {
      hands: [deck.splice(0, 6), deck.splice(0, 6)],
      crib: [],
      starterCard: null,
      deck,
      currentPlayer: 1,
      dealer: 0,
      scores: [0, 0],
      phase: 'discard',
      playPile: [],
      playCount: 0,
      goCount: 0,
      winner: null,
      lastPegPlayer: -1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CribbageState>();
    const players = this.getPlayers();
    const playerIdx = players.indexOf(playerId);

    if (data.phase === 'discard') return this.handleDiscard(data, playerIdx, action, players);
    if (data.phase === 'play') return this.handlePlay(data, playerIdx, action, players);
    return { success: false, error: `Invalid phase` };
  }

  private handleDiscard(
    data: CribbageState,
    playerIdx: number,
    action: GameAction,
    players: string[],
  ): ActionResult {
    if (action.type !== 'discard') return { success: false, error: 'Must discard to crib' };
    const cardKeys = action.payload.cards as string[];
    if (!Array.isArray(cardKeys) || cardKeys.length !== 2)
      return { success: false, error: 'Must discard exactly 2 cards' };

    const cards: Card[] = [];
    for (const key of cardKeys) {
      const [rank, suit] = key.split('_');
      const card: Card = { rank: rank as Rank, suit: suit as Card['suit'] };
      const idx = data.hands[playerIdx].findIndex(
        (c) => c.rank === card.rank && c.suit === card.suit,
      );
      if (idx === -1) return { success: false, error: `Card not in hand: ${key}` };
      cards.push(data.hands[playerIdx].splice(idx, 1)[0]);
    }
    data.crib.push(...cards);

    if (data.crib.length === 4) {
      data.starterCard = data.deck.splice(0, 1)[0];
      if (data.starterCard.rank === 'J') {
        data.scores[data.dealer] += 2;
        if (data.scores[data.dealer] >= 121) data.winner = players[data.dealer];
      }
      data.phase = 'play';
      data.currentPlayer = (data.dealer + 1) % 2;
    }
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handlePlay(
    data: CribbageState,
    playerIdx: number,
    action: GameAction,
    players: string[],
  ): ActionResult {
    if (playerIdx !== data.currentPlayer) return { success: false, error: 'Not your turn' };

    if (action.type === 'go') {
      data.goCount++;
      if (data.goCount >= 2) {
        if (data.lastPegPlayer >= 0) {
          data.scores[data.lastPegPlayer] += 1;
          if (data.scores[data.lastPegPlayer] >= 121) {
            data.winner = players[data.lastPegPlayer];
            this.setData(data);
            return { success: true, newState: this.getState() };
          }
        }
        data.playPile = [];
        data.playCount = 0;
        data.goCount = 0;
        if (data.hands[0].length === 0 && data.hands[1].length === 0) {
          this.endRound(data, players);
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      }
      data.currentPlayer = (data.currentPlayer + 1) % 2;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') return { success: false, error: 'Must play or go' };

    const [rank, suit] = (action.payload.card as string).split('_');
    const card: Card = { rank: rank as Rank, suit: suit as Card['suit'] };
    const idx = data.hands[playerIdx].findIndex(
      (c) => c.rank === card.rank && c.suit === card.suit,
    );
    if (idx === -1) return { success: false, error: 'Card not in hand' };

    const val = cribVal(card.rank);
    if (data.playCount + val > 31) return { success: false, error: 'Would exceed 31' };

    data.hands[playerIdx].splice(idx, 1);
    data.playPile.push(card);
    data.playCount += val;
    data.lastPegPlayer = playerIdx;
    data.goCount = 0;

    let points = 0;
    if (data.playCount === 15) points += 2;
    if (data.playCount === 31) {
      points += 2;
      data.playPile = [];
      data.playCount = 0;
    }

    // Pairs
    if (data.playPile.length >= 2) {
      let pairCount = 0;
      for (let i = data.playPile.length - 2; i >= 0; i--) {
        if (data.playPile[i].rank === card.rank) pairCount++;
        else break;
      }
      if (pairCount === 1) points += 2;
      else if (pairCount === 2) points += 6;
      else if (pairCount === 3) points += 12;
    }

    // Runs
    for (let len = Math.min(data.playPile.length, 7); len >= 3; len--) {
      const lastN = data.playPile.slice(-len);
      const vals = lastN.map((c) => RANKS.indexOf(c.rank)).sort((a, b) => a - b);
      let isRun = true;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] !== vals[i - 1] + 1) {
          isRun = false;
          break;
        }
      }
      if (isRun) {
        points += len;
        break;
      }
    }

    data.scores[playerIdx] += points;
    if (data.scores[playerIdx] >= 121) {
      data.winner = players[playerIdx];
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    data.currentPlayer = (data.currentPlayer + 1) % 2;

    if (data.hands[0].length === 0 && data.hands[1].length === 0) {
      data.scores[playerIdx] += 1; // Last card
      if (data.scores[playerIdx] >= 121) data.winner = players[playerIdx];
      else this.endRound(data, players);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private endRound(data: CribbageState, players: string[]): void {
    // Simplified hand scoring
    data.scores[0] += 2;
    data.scores[1] += 2;
    for (let i = 0; i < 2; i++) {
      if (data.scores[i] >= 121) {
        data.winner = players[i];
        return;
      }
    }
    // New round
    data.dealer = (data.dealer + 1) % 2;
    const deck = shuffle(createDeck());
    data.hands = [deck.splice(0, 6), deck.splice(0, 6)];
    data.deck = deck;
    data.crib = [];
    data.starterCard = null;
    data.phase = 'discard';
    data.playPile = [];
    data.playCount = 0;
    data.goCount = 0;
    data.currentPlayer = (data.dealer + 1) % 2;
    data.lastPegPlayer = -1;
  }

  protected checkGameOver(): boolean {
    return this.getData<CribbageState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<CribbageState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const data = this.getData<CribbageState>();
    const scores: Record<string, number> = {};
    const p = this.getPlayers();
    for (let i = 0; i < p.length; i++) scores[p[i]] = data.scores[i];
    return scores;
  }
}
