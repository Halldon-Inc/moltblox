import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface HanabiCard {
  color: number;
  number: number;
}

interface HanabiState {
  [key: string]: unknown;
  deck: HanabiCard[];
  hands: Record<string, HanabiCard[]>;
  played: number[];
  discarded: HanabiCard[];
  clueTokens: number;
  strikes: number;
  currentPlayer: number;
  finalTurns: number;
  gameEnded: boolean;
  colors: number;
}

export class HanabiGame extends BaseGame {
  readonly name = 'Hanabi';
  readonly version = '1.0.0';
  readonly maxPlayers = 5;

  protected initializeState(playerIds: string[]): HanabiState {
    const colors = 5;
    const deck: HanabiCard[] = [];
    const distribution = [3, 2, 2, 2, 1]; // count of 1s, 2s, 3s, 4s, 5s

    for (let c = 0; c < colors; c++) {
      for (let n = 0; n < 5; n++) {
        for (let i = 0; i < distribution[n]; i++) {
          deck.push({ color: c, number: n + 1 });
        }
      }
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const handSize = playerIds.length <= 3 ? 5 : 4;
    const hands: Record<string, HanabiCard[]> = {};
    for (const p of playerIds) {
      hands[p] = [];
      for (let i = 0; i < handSize; i++) hands[p].push(deck.pop()!);
    }

    return {
      deck,
      hands,
      played: Array(colors).fill(0),
      discarded: [],
      clueTokens: 8,
      strikes: 0,
      currentPlayer: 0,
      finalTurns: -1,
      gameEnded: false,
      colors,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<HanabiState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    switch (action.type) {
      case 'play': {
        const cardIdx = Number(action.payload.cardIndex);
        if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
          return { success: false, error: 'Invalid card index' };
        }
        const card = data.hands[playerId].splice(cardIdx, 1)[0];
        if (data.played[card.color] === card.number - 1) {
          data.played[card.color] = card.number;
          if (card.number === 5 && data.clueTokens < 8) data.clueTokens++;
          this.emitEvent('play_success', playerId, { card });
        } else {
          data.strikes++;
          data.discarded.push(card);
          this.emitEvent('play_fail', playerId, { card });
        }
        if (data.deck.length > 0) data.hands[playerId].push(data.deck.pop()!);
        break;
      }
      case 'discard': {
        if (data.clueTokens >= 8)
          return { success: false, error: 'Cannot discard at max clue tokens' };
        const cardIdx = Number(action.payload.cardIndex);
        if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
          return { success: false, error: 'Invalid card index' };
        }
        const card = data.hands[playerId].splice(cardIdx, 1)[0];
        data.discarded.push(card);
        data.clueTokens++;
        if (data.deck.length > 0) data.hands[playerId].push(data.deck.pop()!);
        break;
      }
      case 'clue': {
        if (data.clueTokens <= 0) return { success: false, error: 'No clue tokens remaining' };
        const target = String(action.payload.target);
        if (!players.includes(target) || target === playerId) {
          return { success: false, error: 'Invalid target player' };
        }
        const clueType = String(action.payload.clueType);
        const clueValue = Number(action.payload.clueValue);
        if (clueType !== 'color' && clueType !== 'number')
          return { success: false, error: 'Clue type must be color or number' };

        const matching = data.hands[target].filter((c) =>
          clueType === 'color' ? c.color === clueValue : c.number === clueValue,
        );
        if (matching.length === 0)
          return { success: false, error: 'Clue must match at least one card' };

        data.clueTokens--;
        this.emitEvent('clue_given', playerId, {
          target,
          clueType,
          clueValue,
          matchCount: matching.length,
        });
        break;
      }
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }

    // Check end conditions
    if (data.strikes >= 3) data.gameEnded = true;
    if (data.played.every((p) => p === 5)) data.gameEnded = true;

    if (data.deck.length === 0 && data.finalTurns < 0) {
      data.finalTurns = players.length;
    }
    if (data.finalTurns > 0) data.finalTurns--;
    if (data.finalTurns === 0) data.gameEnded = true;

    data.currentPlayer = (data.currentPlayer + 1) % players.length;
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<HanabiState>().gameEnded;
  }

  protected determineWinner(): string | null {
    const data = this.getData<HanabiState>();
    const score = data.played.reduce((a, b) => a + b, 0);
    // Cooperative: everyone wins or loses
    return score >= 20 ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<HanabiState>();
    const score = data.played.reduce((a, b) => a + b, 0);
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = score;
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as HanabiState;
    const masked: Record<string, HanabiCard[]> = {};
    for (const [p, cards] of Object.entries(data.hands)) {
      // In Hanabi, you can see OTHER players' cards but not your own
      masked[p] = p === playerId ? cards.map(() => ({ color: -1, number: -1 })) : cards;
    }
    return { ...state, data: { ...data, hands: masked, deck: [] } };
  }
}
