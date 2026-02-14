/**
 * PuzzleInjector: overlays a sequence puzzle on combat/damage actions.
 *
 * When a combat action fires, a puzzle (pattern of 3-5 elements) is created.
 * The player must respond with a 'puzzle_response' action containing their answer.
 * Correct answers yield a 1.5x multiplier; incorrect yield 0.5x.
 */

import type { GameAction, ActionResult } from '@moltblox/protocol';
import type { MechanicInjector, InjectorResult } from '../MechanicInjector.js';

const COMBAT_ACTIONS = ['attack', 'combat', 'damage', 'strike', 'hit'];
const ELEMENTS = ['fire', 'water', 'earth', 'air'];

interface PuzzleChallenge {
  pattern: string[];
  createdAt: number;
}

export class PuzzleInjector implements MechanicInjector {
  readonly name = 'puzzle';

  private pendingPuzzle: PuzzleChallenge | null = null;
  private solvedCount = 0;
  private failedCount = 0;
  private pendingPlayerId: string | null = null;

  initialize(): Record<string, unknown> {
    return {
      _puzzle: {
        pendingPuzzle: null,
        solvedCount: 0,
        failedCount: 0,
      },
    };
  }

  beforeAction(
    playerId: string,
    action: GameAction,
    _stateData: Record<string, unknown>,
  ): InjectorResult {
    // If this is a puzzle response, evaluate it
    if (action.type === 'puzzle_response' && this.pendingPuzzle) {
      const answer = (action.payload.answer as string[]) || [];
      const correct = this.checkAnswer(this.pendingPuzzle.pattern, answer);
      if (correct) {
        this.solvedCount++;
      } else {
        this.failedCount++;
      }
      this.pendingPuzzle = null;
      this.pendingPlayerId = null;

      return {
        proceed: true,
        multiplier: correct ? 1.5 : 0.5,
      };
    }

    // If this is a combat action and no puzzle is pending, create one
    if (COMBAT_ACTIONS.includes(action.type) && !this.pendingPuzzle) {
      const length = 3 + Math.floor(Math.random() * 3); // 3 to 5 elements
      const pattern: string[] = [];
      for (let i = 0; i < length; i++) {
        pattern.push(ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]);
      }

      this.pendingPuzzle = { pattern, createdAt: Date.now() };
      this.pendingPlayerId = playerId;

      return {
        proceed: false,
        challengeState: {
          type: 'puzzle_challenge',
          pattern,
          playerId,
        },
      };
    }

    return { proceed: true };
  }

  afterAction(
    _playerId: string,
    result: ActionResult,
    _stateData: Record<string, unknown>,
  ): ActionResult {
    return result;
  }

  getInjectorState(): Record<string, unknown> {
    return {
      pendingPuzzle: this.pendingPuzzle ? { pattern: this.pendingPuzzle.pattern } : null,
      solvedCount: this.solvedCount,
      failedCount: this.failedCount,
      pendingPlayerId: this.pendingPlayerId,
    };
  }

  private checkAnswer(expected: string[], actual: string[]): boolean {
    if (expected.length !== actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== actual[i]) return false;
    }
    return true;
  }
}
