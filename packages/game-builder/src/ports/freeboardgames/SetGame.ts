import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Each card has 4 attributes, each with 3 values (0,1,2)
interface SetCard {
  color: number; // 0,1,2
  shape: number; // 0,1,2
  number: number; // 0,1,2
  shading: number; // 0,1,2
}

interface SetState {
  [key: string]: unknown;
  deck: SetCard[];
  tableau: (SetCard | null)[];
  scores: Record<string, number>;
  currentPlayer: number;
  winner: string | null;
  gameEnded: boolean;
}

function createDeck(): SetCard[] {
  const cards: SetCard[] = [];
  for (let color = 0; color < 3; color++) {
    for (let shape = 0; shape < 3; shape++) {
      for (let number = 0; number < 3; number++) {
        for (let shading = 0; shading < 3; shading++) {
          cards.push({ color, shape, number, shading });
        }
      }
    }
  }
  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function isValidSet(a: SetCard, b: SetCard, c: SetCard): boolean {
  const check = (attr: keyof SetCard) =>
    (a[attr] === b[attr] && b[attr] === c[attr]) ||
    (a[attr] !== b[attr] && b[attr] !== c[attr] && a[attr] !== c[attr]);
  return check('color') && check('shape') && check('number') && check('shading');
}

function tableauHasSet(tableau: (SetCard | null)[]): boolean {
  const cards = tableau.filter((c): c is SetCard => c !== null);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        if (isValidSet(cards[i], cards[j], cards[k])) return true;
      }
    }
  }
  return false;
}

export class SetGame extends BaseGame {
  readonly name = 'Set';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): SetState {
    const deck = createDeck();
    const tableau: (SetCard | null)[] = [];
    for (let i = 0; i < 12 && deck.length > 0; i++) {
      tableau.push(deck.pop()!);
    }

    const scores: Record<string, number> = {};
    for (const pid of playerIds) scores[pid] = 0;

    return {
      deck,
      tableau,
      scores,
      currentPlayer: 0,
      winner: null,
      gameEnded: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SetState>();

    if (action.type === 'claim_set') {
      const indices = action.payload.indices as number[];
      if (!Array.isArray(indices) || indices.length !== 3) {
        return { success: false, error: 'Must select exactly 3 cards' };
      }

      const cards = indices.map((i) => data.tableau[i]);
      if (cards.some((c) => c === null || c === undefined)) {
        return { success: false, error: 'Invalid card selection' };
      }

      if (!isValidSet(cards[0]!, cards[1]!, cards[2]!)) {
        // Penalty for wrong call
        data.scores[playerId] = (data.scores[playerId] || 0) - 1;
        this.setData(data);
        return { success: false, error: 'Not a valid set' };
      }

      // Remove cards and replace from deck
      data.scores[playerId] = (data.scores[playerId] || 0) + 1;
      for (const idx of indices) {
        if (data.deck.length > 0) {
          data.tableau[idx] = data.deck.pop()!;
        } else {
          data.tableau[idx] = null;
        }
      }

      // Remove null entries and check if more cards needed
      data.tableau = data.tableau.filter((c) => c !== null);

      // Ensure at least 12 cards or until no set exists
      while (data.tableau.length < 12 && data.deck.length > 0) {
        data.tableau.push(data.deck.pop()!);
      }

      // Add more cards if no set in tableau
      while (!tableauHasSet(data.tableau) && data.deck.length > 0) {
        for (let i = 0; i < 3 && data.deck.length > 0; i++) {
          data.tableau.push(data.deck.pop()!);
        }
      }

      // Check game over
      if (!tableauHasSet(data.tableau) && data.deck.length === 0) {
        data.gameEnded = true;
        let bestScore = -Infinity;
        let best: string | null = null;
        for (const [pid, score] of Object.entries(data.scores)) {
          if (score > bestScore) {
            bestScore = score;
            best = pid;
          }
        }
        data.winner = best;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'no_set') {
      // Player claims no set exists, add 3 more cards
      if (tableauHasSet(data.tableau)) {
        data.scores[playerId] = (data.scores[playerId] || 0) - 1;
        this.setData(data);
        return { success: false, error: 'A set exists in the tableau' };
      }
      if (data.deck.length > 0) {
        for (let i = 0; i < 3 && data.deck.length > 0; i++) {
          data.tableau.push(data.deck.pop()!);
        }
      } else {
        data.gameEnded = true;
        let bestScore = -Infinity;
        let best: string | null = null;
        for (const [pid, score] of Object.entries(data.scores)) {
          if (score > bestScore) {
            bestScore = score;
            best = pid;
          }
        }
        data.winner = best;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    return this.getData<SetState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<SetState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<SetState>().scores };
  }
}
