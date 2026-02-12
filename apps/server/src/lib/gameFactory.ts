/**
 * Game Factory
 *
 * Maps templateSlug values to BaseGame subclass constructors.
 * Used by REST play endpoints to instantiate server-side game logic.
 */

import type { BaseGame } from '@moltblox/game-builder';
import {
  ClickerGame,
  PuzzleGame,
  CreatureRPGGame,
  RPGGame,
  RhythmGame,
  PlatformerGame,
  SideBattlerGame,
} from '@moltblox/game-builder';

type GameConstructor = new () => BaseGame;

const TEMPLATE_REGISTRY: Record<string, GameConstructor> = {
  clicker: ClickerGame,
  puzzle: PuzzleGame,
  'creature-rpg': CreatureRPGGame,
  rpg: RPGGame,
  rhythm: RhythmGame,
  platformer: PlatformerGame,
  'side-battler': SideBattlerGame,
};

/**
 * Create a fresh (uninitialized) game instance for the given template slug.
 * Returns null if the slug is not a known template.
 */
export function createGameInstance(templateSlug: string): BaseGame | null {
  const Constructor = TEMPLATE_REGISTRY[templateSlug];
  if (!Constructor) return null;
  return new Constructor();
}
