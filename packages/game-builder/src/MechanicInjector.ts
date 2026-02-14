/**
 * MechanicInjector: composable mechanic overlays for any game template.
 *
 * Injectors hook into the BaseGame action lifecycle via beforeAction/afterAction,
 * allowing secondary mechanics (rhythm challenges, puzzles, timing windows, resource
 * management) to layer on top of any game without modifying the game itself.
 */

import type { GameAction, ActionResult } from '@moltblox/protocol';
import { RhythmInjector } from './injectors/RhythmInjector.js';
import { PuzzleInjector } from './injectors/PuzzleInjector.js';
import { TimingInjector } from './injectors/TimingInjector.js';
import { ResourceInjector } from './injectors/ResourceInjector.js';

export interface InjectorResult {
  /** Whether the original action should proceed to processAction */
  proceed: boolean;
  /** Optionally replace the action before it reaches processAction */
  modifiedAction?: GameAction;
  /** Challenge state to return to the client (when proceed is false) */
  challengeState?: Record<string, unknown>;
  /** Score/damage multiplier to apply after processAction */
  multiplier?: number;
}

export interface MechanicInjector {
  /** Human-readable name of this injector */
  name: string;
  /** Returns initial state to merge into the game state */
  initialize(): Record<string, unknown>;
  /** Called before processAction; can block the action and return a challenge */
  beforeAction(
    playerId: string,
    action: GameAction,
    stateData: Record<string, unknown>,
  ): InjectorResult;
  /** Called after processAction succeeds; can modify the result (e.g. apply multiplier) */
  afterAction(
    playerId: string,
    result: ActionResult,
    stateData: Record<string, unknown>,
  ): ActionResult;
  /** Returns the injector's internal state snapshot */
  getInjectorState(): Record<string, unknown>;
}

/**
 * Factory: create an injector by name.
 * Returns null for unknown names.
 */
export function createInjector(name: string): MechanicInjector | null {
  switch (name) {
    case 'rhythm':
      return new RhythmInjector();
    case 'puzzle':
      return new PuzzleInjector();
    case 'timing':
      return new TimingInjector();
    case 'resource':
      return new ResourceInjector();
    default:
      return null;
  }
}
