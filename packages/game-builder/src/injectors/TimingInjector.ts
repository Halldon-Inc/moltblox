/**
 * TimingInjector: adds a timing window bonus to actions.
 *
 * Every action gets a timing window. beforeAction records the start time and
 * allows the action to proceed. afterAction checks if a timing payload was
 * included and whether it fell within the window for a bonus multiplier.
 *
 * Timing windows:
 *   Perfect (within 100ms): 2.0x
 *   Good (within 300ms): 1.5x
 *   Ok (within 600ms): 1.2x
 *   Outside window: 1.0x (no bonus)
 */

import type { GameAction, ActionResult } from '@moltblox/protocol';
import type { MechanicInjector, InjectorResult } from '../MechanicInjector.js';

const PERFECT_WINDOW = 100;
const GOOD_WINDOW = 300;
const OK_WINDOW = 600;

export class TimingInjector implements MechanicInjector {
  readonly name = 'timing';

  private actionStartTime = 0;
  private lastMultiplier = 1.0;
  private perfectCount = 0;
  private goodCount = 0;
  private okCount = 0;
  private missCount = 0;

  initialize(): Record<string, unknown> {
    return {
      _timing: {
        lastMultiplier: 1.0,
        perfectCount: 0,
        goodCount: 0,
        okCount: 0,
        missCount: 0,
      },
    };
  }

  beforeAction(
    _playerId: string,
    _action: GameAction,
    _stateData: Record<string, unknown>,
  ): InjectorResult {
    // Record the start time; always let the action proceed
    this.actionStartTime = Date.now();
    return { proceed: true };
  }

  afterAction(
    _playerId: string,
    result: ActionResult,
    _stateData: Record<string, unknown>,
  ): ActionResult {
    if (!result.success) return result;

    // Check if the action included a timing payload
    const timingHit = result.newState?.data?._timingHit as number | undefined;
    if (timingHit == null) {
      this.lastMultiplier = 1.0;
      this.missCount++;
      return result;
    }

    const delta = Math.abs(timingHit - this.actionStartTime);
    let multiplier: number;

    if (delta <= PERFECT_WINDOW) {
      multiplier = 2.0;
      this.perfectCount++;
    } else if (delta <= GOOD_WINDOW) {
      multiplier = 1.5;
      this.goodCount++;
    } else if (delta <= OK_WINDOW) {
      multiplier = 1.2;
      this.okCount++;
    } else {
      multiplier = 1.0;
      this.missCount++;
    }

    this.lastMultiplier = multiplier;

    // Apply multiplier to score-related data if present
    const newState = result.newState ? { ...result.newState } : undefined;
    if (newState) {
      newState.data = {
        ...newState.data,
        _timingMultiplier: multiplier,
      };
    }

    return { ...result, newState };
  }

  getInjectorState(): Record<string, unknown> {
    return {
      lastMultiplier: this.lastMultiplier,
      perfectCount: this.perfectCount,
      goodCount: this.goodCount,
      okCount: this.okCount,
      missCount: this.missCount,
    };
  }
}
