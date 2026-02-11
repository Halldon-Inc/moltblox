/**
 * Game-specific bot helpers
 *
 * Convenience functions that return properly typed GenericGameAction objects
 * for each game template. These save bot developers from constructing action
 * objects manually and serve as documentation of available actions per game.
 */

import type { GenericGameAction } from './types.js';

// =============================================================================
// Clicker Game Actions
// =============================================================================

/** Single click action for clicker games */
export function clickAction(): GenericGameAction {
  return { type: 'click' };
}

/** Multi-click power-up action (max 5 per action) */
export function multiClickAction(amount: number): GenericGameAction {
  return { type: 'multi_click', payload: { amount } };
}

// =============================================================================
// Puzzle Game Actions
// =============================================================================

/** Select a cell by index in puzzle games */
export function puzzleSelectAction(index: number): GenericGameAction {
  return { type: 'select', payload: { index } };
}

// =============================================================================
// RPG Game Actions
// =============================================================================

/** Basic attack action for RPG combat */
export function rpgAttackAction(): GenericGameAction {
  return { type: 'attack' };
}

/** Use a skill by index (costs MP) */
export function rpgUseSkillAction(skillIndex: number): GenericGameAction {
  return { type: 'use_skill', payload: { skillIndex } };
}

/** Use an item by name */
export function rpgUseItemAction(itemName: string): GenericGameAction {
  return { type: 'use_item', payload: { item: itemName } };
}

/** Start a new encounter in RPG games */
export function startEncounterAction(): GenericGameAction {
  return { type: 'start_encounter' };
}

// =============================================================================
// Rhythm Game Actions
// =============================================================================

/** Hit a note in a specific lane (0-3) */
export function rhythmHitAction(lane: number): GenericGameAction {
  return { type: 'hit_note', payload: { lane } };
}

// =============================================================================
// Platformer Game Actions
// =============================================================================

/** Move in a direction (left, right, or stop) */
export function platformerMoveAction(direction: 'left' | 'right' | 'stop'): GenericGameAction {
  return { type: 'move', payload: { direction } };
}

/** Jump action for platformer games */
export function platformerJumpAction(): GenericGameAction {
  return { type: 'jump' };
}
