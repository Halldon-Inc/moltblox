import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface DouDizhuConfig {
  bidding?: boolean;
}

/**
 * Dou Dizhu (Fight the Landlord): Chinese card game for 3 players.
 * 54-card deck (standard + 2 jokers). One player is landlord (gets 3 extra cards),
 * two are peasants who cooperate. Landlord plays first.
 * Card combos: solo, pair, trio, trio+solo, trio+pair, chain, bomb, rocket.
 * First to empty hand wins; if landlord wins, landlord scores; else peasants score.
 */

interface DDCard {
  rank: number; // 3-15 (3=3,...,13=K,14=A,15=2,16=black joker,17=red joker)
  suit: number; // 0-3, or 4/5 for jokers
}

type ComboType =
  | 'solo'
  | 'pair'
  | 'trio'
  | 'trio_solo'
  | 'trio_pair'
  | 'chain'
  | 'pair_chain'
  | 'bomb'
  | 'rocket'
  | 'quad_dual'
  | 'pass';

interface Combo {
  type: ComboType;
  rank: number; // primary rank for comparison
  cards: DDCard[];
  length: number; // for chains
}

interface DouDizhuState {
  [key: string]: unknown;
  hands: Record<string, DDCard[]>;
  landlordIdx: number;
  currentPlayer: number;
  lastCombo: Combo | null;
  lastPlayer: number;
  consecutivePasses: number;
  winner: string | null;
  kitty: DDCard[];
}

function createDeck(): DDCard[] {
  const deck: DDCard[] = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (let suit = 0; suit < 4; suit++) {
      deck.push({ rank, suit });
    }
  }
  deck.push({ rank: 16, suit: 4 }); // Black joker
  deck.push({ rank: 17, suit: 5 }); // Red joker
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sortCards(cards: DDCard[]): DDCard[] {
  return [...cards].sort((a, b) => a.rank - b.rank || a.suit - b.suit);
}

function classifyCombo(cards: DDCard[]): Combo | null {
  const sorted = sortCards(cards);
  const n = sorted.length;
  if (n === 0) return null;

  // Rocket: both jokers
  if (n === 2 && sorted[0].rank === 16 && sorted[1].rank === 17) {
    return { type: 'rocket', rank: 99, cards: sorted, length: 1 };
  }

  const counts: Record<number, number> = {};
  for (const c of sorted) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const ranks = Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b);

  // Solo
  if (n === 1) return { type: 'solo', rank: sorted[0].rank, cards: sorted, length: 1 };

  // Pair
  if (n === 2 && counts[sorted[0].rank] === 2) {
    return { type: 'pair', rank: sorted[0].rank, cards: sorted, length: 1 };
  }

  // Bomb (4 of a kind)
  if (n === 4 && counts[sorted[0].rank] === 4) {
    return { type: 'bomb', rank: sorted[0].rank, cards: sorted, length: 1 };
  }

  // Trio
  if (n === 3 && counts[sorted[0].rank] === 3) {
    return { type: 'trio', rank: sorted[0].rank, cards: sorted, length: 1 };
  }

  // Trio + solo
  if (n === 4) {
    const tripleRank = ranks.find((r) => counts[r] === 3);
    if (tripleRank !== undefined && ranks.some((r) => counts[r] === 1)) {
      return { type: 'trio_solo', rank: tripleRank, cards: sorted, length: 1 };
    }
  }

  // Trio + pair
  if (n === 5) {
    const tripleRank = ranks.find((r) => counts[r] === 3);
    const pairRank = ranks.find((r) => counts[r] === 2);
    if (tripleRank !== undefined && pairRank !== undefined) {
      return { type: 'trio_pair', rank: tripleRank, cards: sorted, length: 1 };
    }
  }

  // Chain (5+ consecutive singles, no 2 or jokers)
  if (n >= 5 && ranks.every((r) => r <= 14) && ranks.length === n) {
    const isConsec = ranks[ranks.length - 1] - ranks[0] === n - 1;
    if (isConsec && ranks.every((r) => counts[r] === 1)) {
      return { type: 'chain', rank: ranks[ranks.length - 1], cards: sorted, length: n };
    }
  }

  // Pair chain (3+ consecutive pairs, no 2 or jokers)
  if (n >= 6 && n % 2 === 0) {
    const pairRanks = ranks.filter((r) => counts[r] === 2 && r <= 14);
    if (pairRanks.length === n / 2 && pairRanks.length >= 3) {
      const isConsec = pairRanks[pairRanks.length - 1] - pairRanks[0] === pairRanks.length - 1;
      if (isConsec) {
        return {
          type: 'pair_chain',
          rank: pairRanks[pairRanks.length - 1],
          cards: sorted,
          length: pairRanks.length,
        };
      }
    }
  }

  // Quad + 2 singles
  if (n === 6) {
    const quadRank = ranks.find((r) => counts[r] === 4);
    if (quadRank !== undefined) {
      return { type: 'quad_dual', rank: quadRank, cards: sorted, length: 1 };
    }
  }

  return null;
}

function canBeat(last: Combo, current: Combo): boolean {
  // Rocket beats everything
  if (current.type === 'rocket') return true;
  if (last.type === 'rocket') return false;
  // Bomb beats non-bomb
  if (current.type === 'bomb' && last.type !== 'bomb') return true;
  if (last.type === 'bomb' && current.type !== 'bomb') return false;
  // Same type, higher rank, same length
  if (current.type !== last.type) return false;
  if (current.length !== last.length) return false;
  return current.rank > last.rank;
}

export class DouDizhuGame extends BaseGame {
  readonly name = 'Dou Dizhu';
  readonly version = '1.0.0';
  readonly maxPlayers = 3;

  override initialize(playerIds: string[]): void {
    while (playerIds.length < 3) {
      playerIds.push(`bot-${playerIds.length}`);
    }
    super.initialize(playerIds);
  }

  protected initializeState(playerIds: string[]): DouDizhuState {
    const deck = createDeck();
    const hands: Record<string, DDCard[]> = {};
    // Deal 17 cards each
    for (const pid of playerIds) {
      hands[pid] = sortCards(deck.splice(0, 17));
    }
    // Remaining 3 cards are the kitty
    const kitty = deck.splice(0, 3);

    // Landlord is player 0 by default (simplified; no bidding)
    const landlordIdx = 0;
    hands[playerIds[landlordIdx]].push(...kitty);
    hands[playerIds[landlordIdx]] = sortCards(hands[playerIds[landlordIdx]]);

    return {
      hands,
      landlordIdx,
      currentPlayer: landlordIdx,
      lastCombo: null,
      lastPlayer: -1,
      consecutivePasses: 0,
      winner: null,
      kitty: [...kitty],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<DouDizhuState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'pass') {
      // Can't pass if you're leading (no last combo or you were last player)
      if (data.lastCombo === null || data.lastPlayer === pIdx) {
        return { success: false, error: 'You must play, you are leading' };
      }
      data.consecutivePasses++;
      // If 2 passes, next player leads
      if (data.consecutivePasses >= 2) {
        data.lastCombo = null;
        data.consecutivePasses = 0;
      }
      data.currentPlayer = (pIdx + 1) % 3;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    const cardIds = action.payload.cards as number[];
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return { success: false, error: 'Must play at least one card' };
    }

    const hand = data.hands[playerId];
    // Find cards in hand by matching rank+suit from provided indices
    const playedCards: DDCard[] = [];
    const handCopy = [...hand];
    for (const idx of cardIds) {
      if (idx < 0 || idx >= handCopy.length) {
        return { success: false, error: 'Invalid card index' };
      }
      playedCards.push(handCopy[idx]);
    }

    // Validate combo
    const combo = classifyCombo(playedCards);
    if (!combo) {
      return { success: false, error: 'Invalid card combination' };
    }

    // Must beat last combo if exists
    if (data.lastCombo && data.lastPlayer !== pIdx) {
      if (!canBeat(data.lastCombo, combo)) {
        return {
          success: false,
          error: 'Must play a higher combination of the same type, a bomb, or a rocket',
        };
      }
    }

    // Remove cards from hand (remove by index, highest first to avoid shifting)
    const sortedIndices = [...cardIds].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      hand.splice(idx, 1);
    }

    data.lastCombo = combo;
    data.lastPlayer = pIdx;
    data.consecutivePasses = 0;

    this.emitEvent('play', playerId, { combo: combo.type, rank: combo.rank });

    // Check win
    if (hand.length === 0) {
      data.winner = playerId;
      this.emitEvent('win', playerId, {});
    }

    data.currentPlayer = (pIdx + 1) % 3;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as DouDizhuState;
    const players = this.getPlayers();
    for (const pid of players) {
      if (pid !== playerId) {
        data.hands[pid] = Array(data.hands[pid].length).fill({ rank: 0, suit: -1 });
      }
    }
    return state;
  }

  protected checkGameOver(): boolean {
    return this.getData<DouDizhuState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<DouDizhuState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<DouDizhuState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    const landlordId = players[data.landlordIdx];

    if (data.winner === landlordId) {
      // Landlord wins: +2, peasants: -1 each
      for (const p of players) scores[p] = p === landlordId ? 2 : -1;
    } else if (data.winner) {
      // Peasant wins: peasants +1 each, landlord -2
      for (const p of players) scores[p] = p === landlordId ? -2 : 1;
    } else {
      for (const p of players) scores[p] = 0;
    }
    return scores;
  }
}
