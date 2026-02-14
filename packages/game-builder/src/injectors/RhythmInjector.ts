/**
 * RhythmInjector: overlays a rhythm challenge on combat/damage actions.
 *
 * When a combat action fires, a rhythm challenge (sequence of notes) is created.
 * The player must respond with a 'rhythm_response' action containing their hits.
 * Accuracy determines a score multiplier:
 *   0.5x (miss), 1.0x (ok), 1.5x (good), 2.0x (perfect)
 */

import type { GameAction, ActionResult } from '@moltblox/protocol';
import type { MechanicInjector, InjectorResult } from '../MechanicInjector.js';

const COMBAT_ACTIONS = ['attack', 'combat', 'damage', 'strike', 'hit'];

interface RhythmChallenge {
  notes: number[];
  createdAt: number;
}

export class RhythmInjector implements MechanicInjector {
  readonly name = 'rhythm';

  private pendingChallenge: RhythmChallenge | null = null;
  private lastAccuracy = 0;
  private pendingPlayerId: string | null = null;

  initialize(): Record<string, unknown> {
    return {
      _rhythm: {
        pendingChallenge: null,
        lastAccuracy: 0,
      },
    };
  }

  beforeAction(
    playerId: string,
    action: GameAction,
    _stateData: Record<string, unknown>,
  ): InjectorResult {
    // If this is a rhythm response, evaluate it
    if (action.type === 'rhythm_response' && this.pendingChallenge) {
      const hits = (action.payload.hits as number[]) || [];
      const accuracy = this.evaluateAccuracy(this.pendingChallenge.notes, hits);
      this.lastAccuracy = accuracy;
      const multiplier = this.accuracyToMultiplier(accuracy);
      this.pendingChallenge = null;
      this.pendingPlayerId = null;

      return {
        proceed: true,
        multiplier,
      };
    }

    // If this is a combat action and no challenge is pending, create one
    if (COMBAT_ACTIONS.includes(action.type) && !this.pendingChallenge) {
      const noteCount = 3 + Math.floor(Math.random() * 3); // 3 to 5 notes
      const notes: number[] = [];
      for (let i = 0; i < noteCount; i++) {
        notes.push(Math.floor(Math.random() * 4)); // 0-3 representing note lanes
      }

      this.pendingChallenge = { notes, createdAt: Date.now() };
      this.pendingPlayerId = playerId;

      return {
        proceed: false,
        challengeState: {
          type: 'rhythm_challenge',
          notes,
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
      pendingChallenge: this.pendingChallenge ? { notes: this.pendingChallenge.notes } : null,
      lastAccuracy: this.lastAccuracy,
      pendingPlayerId: this.pendingPlayerId,
    };
  }

  private evaluateAccuracy(expected: number[], actual: number[]): number {
    if (expected.length === 0) return 0;
    let matches = 0;
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] === expected[i]) {
        matches++;
      }
    }
    return matches / expected.length;
  }

  private accuracyToMultiplier(accuracy: number): number {
    if (accuracy >= 0.95) return 2.0; // perfect
    if (accuracy >= 0.7) return 1.5; // good
    if (accuracy >= 0.4) return 1.0; // ok
    return 0.5; // miss
  }
}
