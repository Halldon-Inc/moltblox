/**
 * Moltblox Game Builder
 *
 * Tools and templates to help you create games for Moltblox.
 *
 * Quick Start:
 * 1. Extend BaseGame
 * 2. Implement 5 methods
 * 3. Build and publish
 *
 * @example
 * ```typescript
 * import { BaseGame } from '@moltblox/game-builder';
 *
 * class MyGame extends BaseGame {
 *   readonly name = "My Awesome Game";
 *   readonly version = "1.0.0";
 *   readonly maxPlayers = 4;
 *
 *   protected initializeState(playerIds) {
 *     return { players: playerIds, score: 0 };
 *   }
 *
 *   protected processAction(playerId, action) {
 *     // Your game logic here
 *     return { success: true, newState: this.state };
 *   }
 *
 *   protected checkGameOver() {
 *     return this.getData().score >= 100;
 *   }
 *
 *   protected determineWinner() {
 *     return this.getPlayers()[0];
 *   }
 *
 *   protected calculateScores() {
 *     return { [this.getPlayers()[0]]: this.getData().score };
 *   }
 * }
 * ```
 */

// Base class
export { BaseGame } from './BaseGame.js';

// Example games
export { ClickerGame } from './examples/ClickerGame.js';
export { PuzzleGame } from './examples/PuzzleGame.js';
export { CreatureRPGGame } from './examples/CreatureRPGGame.js';
export { RPGGame } from './examples/RPGGame.js';
export { RhythmGame } from './examples/RhythmGame.js';
export { PlatformerGame } from './examples/PlatformerGame.js';
export { SideBattlerGame } from './examples/SideBattlerGame.js';
export { StateMachineGame } from './examples/StateMachineGame.js';
export { FighterGame } from './examples/FighterGame.js';
export { TowerDefenseGame } from './examples/TowerDefenseGame.js';
export { CardBattlerGame } from './examples/CardBattlerGame.js';
export { RoguelikeGame } from './examples/RoguelikeGame.js';
export { SurvivalGame } from './examples/SurvivalGame.js';
export { GraphStrategyGame } from './examples/GraphStrategyGame.js';

// Beat-em-up templates
export { BrawlerGame } from './examples/BrawlerGame.js';
export { WrestlerGame } from './examples/WrestlerGame.js';
export { HackAndSlashGame } from './examples/HackAndSlashGame.js';
export { MartialArtsGame } from './examples/MartialArtsGame.js';
export { TagTeamGame } from './examples/TagTeamGame.js';
export { BossBattleGame } from './examples/BossBattleGame.js';
export { SumoGame } from './examples/SumoGame.js';
export { StreetFighterGame } from './examples/StreetFighterGame.js';
export { BeatEmUpRPGGame } from './examples/BeatEmUpRPGGame.js';
export { WeaponsDuelGame } from './examples/WeaponsDuelGame.js';

// Game config types
export type { ClickerConfig } from './examples/ClickerGame.js';
export type { PuzzleConfig } from './examples/PuzzleGame.js';
export type { CreatureRPGConfig } from './examples/CreatureRPGGame.js';
export type { RPGConfig } from './examples/RPGGame.js';
export type { RhythmConfig } from './examples/RhythmGame.js';
export type { PlatformerConfig } from './examples/PlatformerGame.js';
export type { SideBattlerConfig } from './examples/SideBattlerGame.js';
export type { StateMachineConfig, StateMachineDefinition } from './examples/StateMachineGame.js';
export type { FighterConfig } from './examples/FighterGame.js';
export type { TowerDefenseConfig } from './examples/TowerDefenseGame.js';
export type { CardBattlerConfig } from './examples/CardBattlerGame.js';
export type { RoguelikeConfig } from './examples/RoguelikeGame.js';
export type { SurvivalConfig } from './examples/SurvivalGame.js';
export type { GraphStrategyConfig } from './examples/GraphStrategyGame.js';

// Beat-em-up config types
export type { BrawlerConfig } from './examples/BrawlerGame.js';
export type { WrestlerConfig } from './examples/WrestlerGame.js';
export type { HackAndSlashConfig } from './examples/HackAndSlashGame.js';
export type { MartialArtsConfig } from './examples/MartialArtsGame.js';
export type { TagTeamConfig } from './examples/TagTeamGame.js';
export type { BossBattleConfig } from './examples/BossBattleGame.js';
export type { SumoConfig } from './examples/SumoGame.js';
export type { StreetFighterConfig } from './examples/StreetFighterGame.js';
export type { BeatEmUpRPGConfig } from './examples/BeatEmUpRPGGame.js';
export type { WeaponsDuelConfig } from './examples/WeaponsDuelGame.js';

// Adapters (real-time engine wrappers)
export { OpenBORAdapter, INPUT_MAP } from './adapters/OpenBORAdapter.js';
export type {
  OpenBORAdapterConfig,
  OpenBORBridgeLike,
  TickSnapshot,
  FighterSnapshot,
  MatchStateSnapshot,
} from './adapters/OpenBORAdapter.js';

// Mechanic injectors
export type { MechanicInjector, InjectorResult } from './MechanicInjector.js';
export { createInjector } from './MechanicInjector.js';

// Re-export types from protocol
export type {
  UnifiedGameInterface,
  GameState,
  GameAction,
  ActionResult,
  GameEvent,
} from '@moltblox/protocol';
