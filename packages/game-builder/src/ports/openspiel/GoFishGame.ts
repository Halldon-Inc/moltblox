import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface GoFishState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  sets: Record<string, number>;
  currentPlayer: number;
  winner: string | null;
}

export class GoFishGame extends BaseGame {
  readonly name = 'Go Fish';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): GoFishState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    const sets: Record<string, number> = {};
    const cardsPerPlayer = playerIds.length <= 3 ? 7 : 5;
    for (const p of playerIds) {
      hands[p] = [];
      sets[p] = 0;
      for (let i = 0; i < cardsPerPlayer; i++) hands[p].push(deck.pop()!);
    }
    return { deck, hands, sets, currentPlayer: 0, winner: null };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GoFishState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'ask') return { success: false, error: `Unknown action: ${action.type}` };

    const target = String(action.payload.target);
    const rank = Number(action.payload.rank);

    if (!players.includes(target) || target === playerId)
      return { success: false, error: 'Invalid target' };
    if (isNaN(rank) || rank < 1 || rank > 13) return { success: false, error: 'Invalid rank' };
    if (!data.hands[playerId].some((c) => c.rank === rank))
      return { success: false, error: 'You must hold at least one card of that rank' };

    const targetCards = data.hands[target].filter((c) => c.rank === rank);
    if (targetCards.length > 0) {
      data.hands[playerId].push(...targetCards);
      data.hands[target] = data.hands[target].filter((c) => c.rank !== rank);
      this.emitEvent('got_cards', playerId, { from: target, rank, count: targetCards.length });
    } else {
      // Go fish
      if (data.deck.length > 0) {
        data.hands[playerId].push(data.deck.pop()!);
      }
      data.currentPlayer = (data.currentPlayer + 1) % players.length;
      this.emitEvent('go_fish', playerId, { rank });
    }

    // Check for completed sets
    this.checkSets(data, playerId);

    // Skip players with no cards
    if (data.hands[playerId].length === 0 && data.deck.length > 0) {
      data.hands[playerId].push(data.deck.pop()!);
    }

    // Check game over
    const totalSets = Object.values(data.sets).reduce((a, b) => a + b, 0);
    if (totalSets >= 13) {
      let best: string | null = null;
      let bestCount = 0;
      for (const p of players) {
        if (data.sets[p] > bestCount) {
          bestCount = data.sets[p];
          best = p;
        }
      }
      data.winner = best;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private checkSets(data: GoFishState, playerId: string): void {
    const rankCounts = new Map<number, number>();
    for (const c of data.hands[playerId]) {
      rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1);
    }
    for (const [rank, count] of rankCounts) {
      if (count >= 4) {
        data.sets[playerId]++;
        data.hands[playerId] = data.hands[playerId].filter((c) => c.rank !== rank);
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<GoFishState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<GoFishState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<GoFishState>().sets };
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as GoFishState;
    const masked: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(data.hands)) {
      masked[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...data, hands: masked, deck: [] } };
  }
}
