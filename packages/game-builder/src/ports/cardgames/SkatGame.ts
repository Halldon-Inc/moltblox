import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface SkatConfig {
  targetScore?: number;
}

interface Card {
  rank: number; // 7,8,9,10,11=J,12=Q,13=K,14=A
  suit: number; // 0=clubs, 1=spades, 2=hearts, 3=diamonds
}

interface SkatState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  skat: Card[];
  bids: Record<string, number>;
  declarer: string | null;
  gameType: string | null; // 'suit' | 'grand' | 'null'
  trumpSuit: number;
  trickCards: Card[];
  trickPlayers: string[];
  leadSuit: number;
  currentPlayer: number;
  dealer: number;
  tricksWon: Record<string, Card[]>;
  scores: Record<string, number>;
  phase: string; // 'bidding' | 'skat' | 'declare' | 'playing' | 'done'
  bidPosition: number;
  highBid: number;
  passedBidders: string[];
  winner: string | null;
  targetScore: number;
  cardPointsWon: Record<string, number>;
}

function createSkatDeck(): Card[] {
  // 32-card deck: 7 through Ace
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (const rank of [7, 8, 9, 10, 11, 12, 13, 14]) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function skatCardPoints(card: Card): number {
  // Skat card points: A=11, 10=10, K=4, Q=3, J=2, others=0
  if (card.rank === 14) return 11;
  if (card.rank === 10) return 10;
  if (card.rank === 13) return 4;
  if (card.rank === 12) return 3;
  if (card.rank === 11) return 2;
  return 0;
}

function skatCardStrength(
  card: Card,
  gameType: string,
  trumpSuit: number,
  leadSuit: number,
): number {
  // In Skat, Jacks are always the highest trumps (in suit and grand games)
  // Jack order: clubs(0) > spades(1) > hearts(2) > diamonds(3)
  if (gameType === 'null') {
    // Null game: no trumps, natural order, 7 low, A high
    if (card.suit === leadSuit) return card.rank;
    return 0;
  }

  // Jack is always trump in suit/grand
  if (card.rank === 11) {
    // Jack strength by suit: clubs highest
    return 2000 + (4 - card.suit);
  }

  if (gameType === 'grand') {
    // Only Jacks are trump in Grand
    if (card.suit === leadSuit) return 100 + card.rank;
    return 0;
  }

  // Suit game
  if (card.suit === trumpSuit) return 1000 + card.rank;
  if (card.suit === leadSuit) return 100 + card.rank;
  return 0;
}

function effectiveSuitSkat(card: Card, gameType: string, trumpSuit: number): number {
  if (gameType !== 'null' && card.rank === 11) return -1; // Jacks are trump, special suit
  return card.suit;
}

/**
 * Skat: German 3-player trick-taking card game with a 32-card deck (7 through Ace).
 * Bidding determines the declarer. Declarer picks up 2 skat cards, declares game type
 * (suit, grand, or null), then plays against the other two.
 * Jacks are always the highest trumps in suit and grand games.
 * Declarer wins by taking 61+ card points (of 120 total).
 * Actions: bid, pass, pick_skat, declare, play_card.
 */
export class SkatGame extends BaseGame {
  readonly name = 'Skat';
  readonly version = '1.0.0';
  readonly maxPlayers = 3;

  protected initializeState(playerIds: string[]): SkatState {
    const cfg = this.config as SkatConfig;
    const deck = createSkatDeck();
    const hands: Record<string, Card[]> = {};
    // Deal 10 cards to each player, 2 to skat
    for (const pid of playerIds) {
      hands[pid] = [];
      for (let i = 0; i < 10; i++) hands[pid].push(deck.pop()!);
    }
    const skat = [deck.pop()!, deck.pop()!];

    const scores: Record<string, number> = {};
    const bids: Record<string, number> = {};
    const tricksWon: Record<string, Card[]> = {};
    const cardPointsWon: Record<string, number> = {};
    const passedBidders: string[] = [];

    for (const pid of playerIds) {
      scores[pid] = 0;
      bids[pid] = 0;
      tricksWon[pid] = [];
      cardPointsWon[pid] = 0;
    }

    return {
      deck: [],
      hands,
      skat,
      bids,
      declarer: null,
      gameType: null,
      trumpSuit: -1,
      trickCards: [],
      trickPlayers: [],
      leadSuit: -1,
      currentPlayer: 1, // Middlehand starts bidding
      dealer: 0,
      tricksWon,
      scores,
      phase: 'bidding',
      bidPosition: 0,
      highBid: 0,
      passedBidders,
      winner: null,
      targetScore: cfg.targetScore ?? 301,
      cardPointsWon,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SkatState>();
    const players = this.getPlayers();

    if (data.phase === 'bidding') {
      if (action.type === 'bid') {
        const amount = Number(action.payload.amount);
        if (isNaN(amount) || amount <= data.highBid) {
          return { success: false, error: `Bid must exceed ${data.highBid}` };
        }
        // Valid Skat bid values: 18, 20, 22, 23, 24, 27, 30, ...
        data.highBid = amount;
        data.bids[playerId] = amount;
        this.emitEvent('bid_placed', playerId, { amount });
        this.advanceBidding(data, players);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'pass') {
        data.passedBidders.push(playerId);
        this.emitEvent('bid_passed', playerId, {});

        const activeBidders = players.filter((p) => !data.passedBidders.includes(p));
        if (activeBidders.length === 1) {
          data.declarer = activeBidders[0];
          data.phase = 'skat';
          data.currentPlayer = players.indexOf(data.declarer);
          this.emitEvent('declarer_chosen', data.declarer, { bid: data.highBid });
        } else if (activeBidders.length === 0) {
          // All passed: re-deal (simplified: first player becomes declarer at 18)
          data.declarer = players[1]; // Middlehand by default
          data.highBid = 18;
          data.phase = 'skat';
          data.currentPlayer = players.indexOf(data.declarer);
        } else {
          this.advanceBidding(data, players);
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    if (data.phase === 'skat' && action.type === 'pick_skat') {
      if (playerId !== data.declarer) {
        return { success: false, error: 'Only declarer can pick up skat' };
      }
      // Add skat to hand
      data.hands[playerId].push(...data.skat);

      // Declarer must discard 2 cards
      const discardIndices = action.payload.discardIndices as number[] | undefined;
      if (!Array.isArray(discardIndices) || discardIndices.length !== 2) {
        return { success: false, error: 'Must discard exactly 2 cards (provide discardIndices)' };
      }

      const hand = data.hands[playerId];
      for (const idx of discardIndices) {
        if (idx < 0 || idx >= hand.length) {
          return { success: false, error: 'Invalid discard index' };
        }
      }

      const sorted = [...discardIndices].sort((a, b) => b - a);
      const discarded: Card[] = [];
      for (const idx of sorted) {
        discarded.push(hand.splice(idx, 1)[0]);
      }

      // Discarded cards count towards declarer's trick points
      data.skat = discarded;
      let skatPoints = 0;
      for (const c of discarded) skatPoints += skatCardPoints(c);
      data.cardPointsWon[playerId] = skatPoints;

      data.phase = 'declare';
      this.emitEvent('skat_picked', playerId, { skatPoints });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'declare' && action.type === 'declare') {
      if (playerId !== data.declarer) {
        return { success: false, error: 'Only declarer can declare' };
      }
      const gt = action.payload.gameType as string;
      if (!['suit', 'grand', 'null'].includes(gt)) {
        return { success: false, error: 'Game type must be suit, grand, or null' };
      }
      data.gameType = gt;

      if (gt === 'suit') {
        const suit = Number(action.payload.trumpSuit);
        if (isNaN(suit) || suit < 0 || suit > 3) {
          return { success: false, error: 'Must specify trumpSuit (0-3) for suit game' };
        }
        data.trumpSuit = suit;
      } else if (gt === 'grand') {
        data.trumpSuit = -1; // Only jacks are trump
      } else {
        data.trumpSuit = -1; // No trump in null
      }

      data.phase = 'playing';
      // Forehand (player after dealer) leads
      data.currentPlayer = (data.dealer + 1) % 3;
      this.emitEvent('game_declared', playerId, { gameType: gt, trumpSuit: data.trumpSuit });
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'playing' && action.type === 'play_card') {
      const pIdx = players.indexOf(playerId);
      if (pIdx !== data.currentPlayer) {
        return { success: false, error: 'Not your turn' };
      }

      const cardIdx = Number(action.payload.cardIndex);
      const hand = data.hands[playerId];
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= hand.length) {
        return { success: false, error: 'Invalid card index' };
      }

      const card = hand[cardIdx];
      const cardEffSuit = effectiveSuitSkat(card, data.gameType!, data.trumpSuit);

      // Must follow lead suit (considering effective suits)
      if (data.trickCards.length > 0 && data.leadSuit !== -1) {
        const hasLeadSuit = hand.some(
          (c) => effectiveSuitSkat(c, data.gameType!, data.trumpSuit) === data.leadSuit,
        );
        if (hasLeadSuit && cardEffSuit !== data.leadSuit) {
          return { success: false, error: 'Must follow lead suit' };
        }
      }

      if (data.trickCards.length === 0) {
        data.leadSuit = cardEffSuit;
      }

      hand.splice(cardIdx, 1);
      data.trickCards.push(card);
      data.trickPlayers.push(playerId);

      if (data.trickCards.length === 3) {
        // Resolve trick
        let bestIdx = 0;
        let bestStr = -1;
        for (let i = 0; i < data.trickCards.length; i++) {
          const s = skatCardStrength(
            data.trickCards[i],
            data.gameType!,
            data.trumpSuit,
            data.leadSuit,
          );
          if (s > bestStr) {
            bestStr = s;
            bestIdx = i;
          }
        }
        const trickWinner = data.trickPlayers[bestIdx];
        data.tricksWon[trickWinner].push(...data.trickCards);

        // Count card points
        let trickPoints = 0;
        for (const tc of data.trickCards) trickPoints += skatCardPoints(tc);
        data.cardPointsWon[trickWinner] = (data.cardPointsWon[trickWinner] || 0) + trickPoints;

        this.emitEvent('trick_won', trickWinner, { points: trickPoints });

        data.trickCards = [];
        data.trickPlayers = [];
        data.leadSuit = -1;
        data.currentPlayer = players.indexOf(trickWinner);

        // Check if all cards played (10 tricks)
        const allEmpty = players.every((p) => data.hands[p].length === 0);
        if (allEmpty) {
          this.scoreGame(data, players);
        }
      } else {
        data.currentPlayer = (data.currentPlayer + 1) % 3;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Invalid action '${action.type}' in phase '${data.phase}'` };
  }

  private advanceBidding(data: SkatState, players: string[]): void {
    let next = (data.currentPlayer + 1) % 3;
    let attempts = 0;
    while (data.passedBidders.includes(players[next]) && attempts < 3) {
      next = (next + 1) % 3;
      attempts++;
    }
    data.currentPlayer = next;
  }

  private scoreGame(data: SkatState, players: string[]): void {
    const declarer = data.declarer!;

    if (data.gameType === 'null') {
      // Null game: declarer wins by taking 0 tricks
      const declarerTricks = data.tricksWon[declarer].length;
      if (declarerTricks === 0) {
        data.scores[declarer] += 23; // Base value for null
        data.winner = declarer;
      } else {
        data.scores[declarer] -= 23;
        // Defenders win
        const defenders = players.filter((p) => p !== declarer);
        data.winner = defenders[0];
      }
    } else {
      // Suit or Grand: declarer needs 61+ card points
      const declarerPoints = data.cardPointsWon[declarer] || 0;

      // Game value calculation (simplified)
      let baseValue = 0;
      if (data.gameType === 'grand') baseValue = 24;
      else {
        // Suit values: diamonds=9, hearts=10, spades=11, clubs=12
        const suitValues: Record<number, number> = { 3: 9, 2: 10, 1: 11, 0: 12 };
        baseValue = suitValues[data.trumpSuit] || 9;
      }

      // Count matadors (consecutive jacks from top)
      const declarerHand = [...data.tricksWon[declarer], ...data.skat];
      const hasJackClubs = declarerHand.some((c) => c.rank === 11 && c.suit === 0);
      let matadors = 0;
      const jackSuits = [0, 1, 2, 3]; // clubs, spades, hearts, diamonds
      if (hasJackClubs) {
        matadors = 1;
        for (let i = 1; i < jackSuits.length; i++) {
          if (declarerHand.some((c) => c.rank === 11 && c.suit === jackSuits[i])) {
            matadors++;
          } else break;
        }
      } else {
        matadors = 1;
        for (let i = 0; i < jackSuits.length; i++) {
          if (!declarerHand.some((c) => c.rank === 11 && c.suit === jackSuits[i])) {
            matadors++;
          } else break;
        }
      }

      const gameValue = baseValue * (matadors + 1);

      if (declarerPoints >= 61) {
        data.scores[declarer] += gameValue;
        data.winner = declarer;
        this.emitEvent('declarer_wins', declarer, {
          cardPoints: declarerPoints,
          gameValue,
        });
      } else {
        // Declarer loses: double negative
        data.scores[declarer] -= 2 * gameValue;
        const defenders = players.filter((p) => p !== declarer);
        data.winner = defenders[0];
        this.emitEvent('declarer_loses', declarer, {
          cardPoints: declarerPoints,
          penalty: 2 * gameValue,
        });
      }
    }

    data.phase = 'done';
  }

  protected checkGameOver(): boolean {
    return this.getData<SkatState>().phase === 'done';
  }

  protected determineWinner(): string | null {
    return this.getData<SkatState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<SkatState>().scores };
  }
}
