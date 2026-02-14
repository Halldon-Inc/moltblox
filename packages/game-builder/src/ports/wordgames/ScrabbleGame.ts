import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 5,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 4,
  X: 8,
  Y: 4,
  Z: 10,
};

interface ScrabbleState {
  [key: string]: unknown;
  board: (string | null)[][];
  hands: Record<string, string[]>;
  scores: Record<string, number>;
  bag: string[];
  currentPlayer: number;
  passes: number;
  size: number;
}

export class ScrabbleGame extends BaseGame {
  readonly name = 'Scrabble';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private makeBag(): string[] {
    const dist: Record<string, number> = {
      A: 9,
      B: 2,
      C: 2,
      D: 4,
      E: 12,
      F: 2,
      G: 3,
      H: 2,
      I: 9,
      J: 1,
      K: 1,
      L: 4,
      M: 2,
      N: 6,
      O: 8,
      P: 2,
      Q: 1,
      R: 6,
      S: 4,
      T: 6,
      U: 4,
      V: 2,
      W: 2,
      X: 1,
      Y: 2,
      Z: 1,
    };
    const bag: string[] = [];
    for (const [letter, count] of Object.entries(dist))
      for (let i = 0; i < count; i++) bag.push(letter);
    return bag.sort(() => Math.random() - 0.5);
  }

  protected initializeState(playerIds: string[]): ScrabbleState {
    const bag = this.makeBag();
    const hands: Record<string, string[]> = {};
    for (const p of playerIds) {
      hands[p] = bag.splice(0, 7);
    }
    return {
      board: Array.from({ length: 15 }, () => Array(15).fill(null)),
      hands,
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      bag,
      currentPlayer: 0,
      passes: 0,
      size: 15,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<ScrabbleState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'pass') {
      d.passes++;
      d.currentPlayer = (d.currentPlayer + 1) % players.length;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'exchange') {
      const letters = action.payload.letters as string[];
      if (!letters || letters.length === 0)
        return { success: false, error: 'No letters to exchange' };
      const hand = d.hands[playerId];
      for (const l of letters) {
        const idx = hand.indexOf(l);
        if (idx < 0) return { success: false, error: 'Letter not in hand' };
        hand.splice(idx, 1);
        d.bag.push(l);
      }
      d.bag.sort(() => Math.random() - 0.5);
      while (hand.length < 7 && d.bag.length > 0) hand.push(d.bag.pop()!);
      d.currentPlayer = (d.currentPlayer + 1) % players.length;
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') return { success: false, error: 'Use play, exchange, or pass' };

    const tiles = action.payload.tiles as Array<{ letter: string; row: number; col: number }>;
    if (!tiles || tiles.length === 0) return { success: false, error: 'No tiles placed' };

    d.passes = 0;
    let score = 0;
    const hand = d.hands[playerId];
    for (const t of tiles) {
      const idx = hand.indexOf(t.letter);
      if (idx < 0) return { success: false, error: `Letter ${t.letter} not in hand` };
      if (t.row < 0 || t.row >= d.size || t.col < 0 || t.col >= d.size)
        return { success: false, error: 'Out of bounds' };
      if (d.board[t.row][t.col] !== null) return { success: false, error: 'Cell occupied' };
      hand.splice(idx, 1);
      d.board[t.row][t.col] = t.letter;
      score += LETTER_VALUES[t.letter] || 1;
    }

    d.scores[playerId] += score;
    while (hand.length < 7 && d.bag.length > 0) hand.push(d.bag.pop()!);
    d.currentPlayer = (d.currentPlayer + 1) % players.length;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<ScrabbleState>();
    if (d.passes >= this.getPlayerCount() * 2) return true;
    const players = this.getPlayers();
    return d.bag.length === 0 && players.some((p) => d.hands[p].length === 0);
  }

  protected determineWinner(): string | null {
    const d = this.getData<ScrabbleState>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return best || null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<ScrabbleState>().scores };
  }
}
