import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const PUZZLES = [
  { numbers: [1, 2, 3, 4] },
  { numbers: [8, 3, 8, 3] },
  { numbers: [1, 5, 5, 5] },
  { numbers: [2, 3, 4, 6] },
  { numbers: [3, 3, 8, 8] },
];

interface Math24State {
  [key: string]: unknown;
  numbers: number[];
  scores: Record<string, number>;
  currentRound: number;
  maxRounds: number;
  solved: boolean;
  winner: string | null;
}

export class Math24Game extends BaseGame {
  readonly name = 'Math 24';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): Math24State {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    return {
      numbers: puzzle.numbers,
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      currentRound: 1,
      maxRounds: 5,
      solved: false,
      winner: null,
    };
  }

  private evaluate(expr: string, _nums: number[]): number | null {
    try {
      const cleaned = expr.replace(/\s/g, '');
      if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;
      const result = this.parseExpr(cleaned, { pos: 0 });
      return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }

  private parseExpr(s: string, ctx: { pos: number }): number {
    let left = this.parseTerm(s, ctx);
    while (ctx.pos < s.length && (s[ctx.pos] === '+' || s[ctx.pos] === '-')) {
      const op = s[ctx.pos++];
      const right = this.parseTerm(s, ctx);
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(s: string, ctx: { pos: number }): number {
    let left = this.parseFactor(s, ctx);
    while (ctx.pos < s.length && (s[ctx.pos] === '*' || s[ctx.pos] === '/')) {
      const op = s[ctx.pos++];
      const right = this.parseFactor(s, ctx);
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  private parseFactor(s: string, ctx: { pos: number }): number {
    if (s[ctx.pos] === '(') {
      ctx.pos++;
      const val = this.parseExpr(s, ctx);
      ctx.pos++; // skip ')'
      return val;
    }
    let numStr = '';
    while (ctx.pos < s.length && /[0-9.]/.test(s[ctx.pos])) {
      numStr += s[ctx.pos++];
    }
    return Number(numStr);
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    if (action.type !== 'solve') return { success: false, error: 'Use solve action' };
    const d = this.getData<Math24State>();
    const expr = action.payload.expression as string;
    if (!expr) return { success: false, error: 'Provide expression' };

    const result = this.evaluate(expr, d.numbers);
    if (result === null) return { success: false, error: 'Invalid expression' };

    if (Math.abs(result - 24) < 0.001) {
      d.scores[playerId] += 100;
      d.solved = true;
      // Next round
      if (d.currentRound < d.maxRounds) {
        d.currentRound++;
        d.solved = false;
        const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
        d.numbers = puzzle.numbers;
      }
    } else {
      d.scores[playerId] = Math.max(0, d.scores[playerId] - 10);
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<Math24State>();
    return d.currentRound >= d.maxRounds && d.solved;
  }

  protected determineWinner(): string | null {
    const d = this.getData<Math24State>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return bestScore > 0 ? best : null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<Math24State>().scores };
  }
}
