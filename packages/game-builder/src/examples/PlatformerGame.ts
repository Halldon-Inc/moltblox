/**
 * PlatformerGame - Side-scrolling platformer
 *
 * Run, jump, and collect items while avoiding hazards!
 * Demonstrates:
 * - Physics simulation (gravity, velocity, collision)
 * - Level design with platforms, collectibles, and hazards
 * - Checkpoint system for player-friendly progression
 * - Score optimization through risk/reward exploration
 *
 * WHY physics tuning defines game feel:
 * The difference between a "good" and "bad" platformer is almost entirely
 * in how the jump feels. Gravity, jump force, air control, and coyote time
 * (the grace period after walking off a ledge where you can still jump) are
 * the four variables that define whether a platformer feels tight or floaty.
 * This template exposes these as tunable constants so bots can experiment
 * with game feel parameters.
 *
 * WHY collectibles create exploration motivation:
 * Coins and items placed off the main path give players a reason to explore
 * instead of rushing to the exit. The score bonus for collecting everything
 * creates a secondary objective that adds replayability. Speed-runners skip
 * items for time; completionists grab everything for score. Both playstyles
 * are valid, which is a sign of good level design.
 *
 * This is a ~250 line complete game that bots can study and modify.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface PlatformerConfig {
  startingLives?: number;
  gravity?: number;
  jumpForce?: number;
  /** Horizontal movement distance per move action (1-10, default 4). */
  playerMoveSpeed?: number;
  /** Mid-air steering multiplier (0-1, default 0.7). Applied when player is airborne. */
  airControl?: number;
  /** Terminal velocity when falling (5-30, default 15). */
  maxFallSpeed?: number;
  /** Controls hazard/obstacle count: low = 50%, high = 150% of default (default 'medium'). */
  hazardDensity?: 'low' | 'medium' | 'high';
  secondaryMechanic?: 'rhythm' | 'puzzle' | 'timing' | 'resource';
}

interface Vector2 {
  x: number;
  y: number;
}

interface PlayerPhysics {
  position: Vector2;
  velocity: Vector2;
  onGround: boolean;
  facingRight: boolean;
  coyoteTimer: number; // Frames since leaving ground (for coyote time)
  jumpBufferTimer: number; // Frames since jump was pressed (for input buffering)
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Collectible {
  id: number;
  x: number;
  y: number;
  type: 'coin' | 'gem' | 'powerup';
  value: number;
  collected: boolean;
}

/**
 * WHY hazard variety prevents monotony: If every hazard is a spike pit,
 * players learn one avoidance pattern and the game becomes rote. Mixing
 * static hazards (spikes), moving hazards (enemies), and timed hazards
 * (falling platforms) forces players to use different skills for each
 * obstacle, keeping the gameplay mentally engaging throughout.
 */
interface Hazard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spikes' | 'moving_enemy' | 'falling_platform';
  moveSpeed?: number; // For moving enemies
  moveRange?: number; // Movement amplitude
  moveOffset?: number; // Current position offset
}

interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
}

interface PlatformerState {
  [key: string]: unknown;
  players: Record<
    string,
    {
      physics: PlayerPhysics;
      lives: number;
      score: number;
      coinsCollected: number;
      checkpoint: Vector2; // Last activated checkpoint position
      finished: boolean; // Reached the level exit
    }
  >;
  platforms: Platform[];
  collectibles: Collectible[];
  hazards: Hazard[];
  checkpoints: Checkpoint[];
  levelWidth: number;
  levelHeight: number;
  exitX: number; // Level exit position
  exitY: number;
  tick: number; // Game tick counter for physics
}

/**
 * Physics constants.
 * WHY these specific values: These are tuned to feel "snappy" — high gravity
 * with a strong jump impulse creates the responsive, arcade-like feel that
 * most players prefer. Low gravity + weak jump = floaty (like underwater).
 * High gravity + strong jump = snappy (like Mario). Air control at 70% of
 * ground speed lets players adjust mid-air without feeling like they're
 * flying.
 */
const PHYSICS = {
  GRAVITY: 0.8,
  JUMP_FORCE: -12,
  MOVE_SPEED: 4,
  AIR_CONTROL: 0.7, // Multiplier on horizontal speed while airborne
  MAX_FALL_SPEED: 15,
  COYOTE_TIME: 6, // Frames of grace after leaving a platform
  JUMP_BUFFER: 4, // Frames to buffer a jump input before landing
  PLAYER_WIDTH: 1,
  PLAYER_HEIGHT: 2,
};

export class PlatformerGame extends BaseGame {
  readonly name = 'Voxel Runner';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private readonly LEVEL_WIDTH = 100;
  private readonly LEVEL_HEIGHT = 20;

  protected initializeState(playerIds: string[]): PlatformerState {
    const cfg = this.config as PlatformerConfig;
    const startingLives = cfg.startingLives ?? 3;

    const players: PlatformerState['players'] = {};
    const spawnPoint: Vector2 = { x: 2, y: 15 };

    for (const pid of playerIds) {
      players[pid] = {
        physics: {
          position: { ...spawnPoint },
          velocity: { x: 0, y: 0 },
          onGround: false,
          facingRight: true,
          coyoteTimer: 0,
          jumpBufferTimer: 0,
        },
        lives: startingLives,
        score: 0,
        coinsCollected: 0,
        checkpoint: { ...spawnPoint },
        finished: false,
      };
    }

    // Generate level layout
    const platforms = this.generatePlatforms();
    const collectibles = this.generateCollectibles();
    const densityMap: Record<string, number> = { low: 0.5, medium: 1.0, high: 1.5 };
    const hDensity = densityMap[cfg.hazardDensity ?? 'medium'] ?? 1.0;
    const hazards = this.generateHazards(hDensity);
    const checkpoints = this.generateCheckpoints();

    return {
      players,
      platforms,
      collectibles,
      hazards,
      checkpoints,
      levelWidth: this.LEVEL_WIDTH,
      levelHeight: this.LEVEL_HEIGHT,
      exitX: 95,
      exitY: 14,
      tick: 0,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PlatformerState>();
    const player = data.players[playerId];

    if (!player || player.finished || player.lives <= 0) {
      return { success: false, error: 'Player cannot act' };
    }

    switch (action.type) {
      /**
       * Move left or right.
       * WHY separate move and jump: Platformers need precise control over
       * horizontal and vertical movement independently. Combining them into
       * one action would remove the player's ability to jump straight up
       * or move without jumping — both essential maneuvers.
       */
      case 'move': {
        const direction = String(action.payload.direction);
        const phys = player.physics;
        const cfgMove = this.config as PlatformerConfig;
        const mSpeed = cfgMove.playerMoveSpeed ?? PHYSICS.MOVE_SPEED;
        const aControl = cfgMove.airControl ?? PHYSICS.AIR_CONTROL;

        const speedMultiplier = phys.onGround ? 1.0 : aControl;

        if (direction === 'left') {
          phys.velocity.x = -mSpeed * speedMultiplier;
          phys.facingRight = false;
        } else if (direction === 'right') {
          phys.velocity.x = mSpeed * speedMultiplier;
          phys.facingRight = true;
        } else if (direction === 'stop') {
          phys.velocity.x = 0;
        } else {
          return { success: false, error: 'Direction must be left, right, or stop' };
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Jump.
       * WHY coyote time and jump buffering exist: These are "invisible" QoL
       * features that make the game feel fair. Coyote time lets you jump for
       * a few frames after walking off a ledge (because players often press
       * jump slightly late). Jump buffering registers a jump press slightly
       * before landing (because players often press jump slightly early).
       * Without these, players constantly feel like the game "ate their input."
       */
      case 'jump': {
        const phys = player.physics;
        const cfgJump = this.config as PlatformerConfig;
        const jumpForce = cfgJump.jumpForce ?? PHYSICS.JUMP_FORCE;

        const canJump = phys.onGround || phys.coyoteTimer < PHYSICS.COYOTE_TIME;

        if (canJump) {
          phys.velocity.y = jumpForce;
          phys.onGround = false;
          phys.coyoteTimer = PHYSICS.COYOTE_TIME; // Consume coyote time
          this.emitEvent('jump', playerId, { position: phys.position });
        } else {
          // Buffer the jump for when we land
          phys.jumpBufferTimer = PHYSICS.JUMP_BUFFER;
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      /**
       * Advance physics by one tick.
       * This is the core simulation step: apply gravity, move entities,
       * resolve collisions, check pickups and hazards.
       */
      case 'tick': {
        data.tick++;
        const cfgPhys = this.config as PlatformerConfig;
        const gravity = cfgPhys.gravity ?? PHYSICS.GRAVITY;

        for (const pid of this.getPlayers()) {
          const p = data.players[pid];
          if (p.finished || p.lives <= 0) continue;

          const phys = p.physics;

          // Apply gravity
          const maxFall = cfgPhys.maxFallSpeed ?? PHYSICS.MAX_FALL_SPEED;
          phys.velocity.y = Math.min(phys.velocity.y + gravity, maxFall);

          // Update position
          phys.position.x += phys.velocity.x;
          phys.position.y += phys.velocity.y;

          // Track coyote time
          if (!phys.onGround) {
            phys.coyoteTimer++;
          }

          // Decrement jump buffer
          if (phys.jumpBufferTimer > 0) {
            phys.jumpBufferTimer--;
          }

          // Platform collision
          phys.onGround = false;
          for (const platform of data.platforms) {
            if (this.checkCollision(phys.position, platform)) {
              const overlapLeft = phys.position.x + PHYSICS.PLAYER_WIDTH - platform.x;
              const overlapRight = platform.x + platform.width - phys.position.x;
              const overlapTop = phys.position.y + PHYSICS.PLAYER_HEIGHT - platform.y;
              const overlapBottom = platform.y + platform.height - phys.position.y;

              const minOverlapX = Math.min(overlapLeft, overlapRight);
              const minOverlapY = Math.min(overlapTop, overlapBottom);

              if (minOverlapY <= minOverlapX) {
                // Vertical collision
                if (phys.velocity.y >= 0 && overlapTop <= overlapBottom) {
                  // Land on top of platform
                  phys.position.y = platform.y - PHYSICS.PLAYER_HEIGHT;
                  phys.velocity.y = 0;
                  phys.onGround = true;
                  phys.coyoteTimer = 0;

                  // Check buffered jump
                  if (phys.jumpBufferTimer > 0) {
                    const cfgBuf = this.config as PlatformerConfig;
                    phys.velocity.y = cfgBuf.jumpForce ?? PHYSICS.JUMP_FORCE;
                    phys.onGround = false;
                    phys.jumpBufferTimer = 0;
                  }
                } else if (phys.velocity.y < 0) {
                  // Hit head on bottom of platform
                  phys.position.y = platform.y + platform.height;
                  phys.velocity.y = 0;
                }
              } else {
                // Horizontal collision: push player out of platform side
                if (overlapLeft < overlapRight) {
                  phys.position.x = platform.x - PHYSICS.PLAYER_WIDTH;
                } else {
                  phys.position.x = platform.x + platform.width;
                }
                phys.velocity.x = 0;
              }
            }
          }

          // Floor collision (bottom of level)
          if (phys.position.y >= this.LEVEL_HEIGHT) {
            this.handleDeath(data, pid);
            continue;
          }

          // Collectible pickup
          for (const collectible of data.collectibles) {
            if (collectible.collected) continue;
            const dx = Math.abs(phys.position.x - collectible.x);
            const dy = Math.abs(phys.position.y - collectible.y);
            if (dx < 1.5 && dy < 1.5) {
              collectible.collected = true;
              p.score += collectible.value;
              p.coinsCollected++;
              this.emitEvent('item_collected', pid, {
                type: collectible.type,
                value: collectible.value,
              });
            }
          }

          // Hazard collision
          for (const hazard of data.hazards) {
            // Update moving enemies
            if (hazard.type === 'moving_enemy' && hazard.moveSpeed && hazard.moveRange) {
              hazard.moveOffset = (hazard.moveOffset || 0) + hazard.moveSpeed;
              if (Math.abs(hazard.moveOffset) > hazard.moveRange) {
                hazard.moveSpeed = -hazard.moveSpeed;
              }
            }

            const hazardX = hazard.x + (hazard.moveOffset || 0);
            const dx = Math.abs(phys.position.x - hazardX);
            const dy = Math.abs(phys.position.y - hazard.y);
            if (
              dx < hazard.width / 2 + PHYSICS.PLAYER_WIDTH / 2 &&
              dy < hazard.height / 2 + PHYSICS.PLAYER_HEIGHT / 2
            ) {
              this.handleDeath(data, pid);
              break;
            }
          }

          // Checkpoint activation
          for (const checkpoint of data.checkpoints) {
            if (checkpoint.activated) continue;
            const dx = Math.abs(phys.position.x - checkpoint.x);
            const dy = Math.abs(phys.position.y - checkpoint.y);
            if (dx < 2 && dy < 2) {
              checkpoint.activated = true;
              p.checkpoint = { x: checkpoint.x, y: checkpoint.y };
              this.emitEvent('checkpoint_activated', pid, { x: checkpoint.x });
            }
          }

          // Level exit check
          const dx = Math.abs(phys.position.x - data.exitX);
          const dy = Math.abs(phys.position.y - data.exitY);
          if (dx < 2 && dy < 2) {
            p.finished = true;
            // Time bonus: fewer ticks = more points
            const timeBonus = Math.max(0, 5000 - data.tick * 5);
            p.score += timeBonus;
            this.emitEvent('level_complete', pid, { score: p.score, timeBonus });
          }
        }

        // Apply horizontal friction (deceleration when not actively moving)
        for (const pid of this.getPlayers()) {
          const phys = data.players[pid].physics;
          phys.velocity.x *= 0.85; // Friction
          if (Math.abs(phys.velocity.x) < 0.1) phys.velocity.x = 0;
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  /**
   * Handle player death: lose a life, respawn at checkpoint.
   * WHY checkpoints matter: Without checkpoints, dying sends players back
   * to the start, which is punishing and discouraging. Checkpoints break
   * the level into digestible segments. Each checkpoint feels like a "save
   * point" — a small victory that the player doesn't have to re-earn.
   */
  private handleDeath(data: PlatformerState, playerId: string): void {
    const player = data.players[playerId];
    player.lives--;

    if (player.lives > 0) {
      // Respawn at last checkpoint
      player.physics.position = { ...player.checkpoint };
      player.physics.velocity = { x: 0, y: 0 };
      player.physics.onGround = false;
      player.physics.coyoteTimer = 0;
      this.emitEvent('player_died', playerId, {
        livesRemaining: player.lives,
        respawnAt: player.checkpoint,
      });
    } else {
      this.emitEvent('player_eliminated', playerId, { finalScore: player.score });
    }
  }

  /**
   * Simple AABB collision check between player and a rectangular object.
   */
  private checkCollision(playerPos: Vector2, rect: Platform): boolean {
    return (
      playerPos.x + PHYSICS.PLAYER_WIDTH > rect.x &&
      playerPos.x < rect.x + rect.width &&
      playerPos.y + PHYSICS.PLAYER_HEIGHT > rect.y &&
      playerPos.y < rect.y + rect.height
    );
  }

  protected checkGameOver(): boolean {
    const data = this.getData<PlatformerState>();
    // Game ends when all players have finished or run out of lives
    return this.getPlayers().every((pid) => {
      const p = data.players[pid];
      return p.finished || p.lives <= 0;
    });
  }

  protected determineWinner(): string | null {
    const data = this.getData<PlatformerState>();
    let bestPlayer: string | null = null;
    let bestScore = -1;

    for (const pid of this.getPlayers()) {
      const p = data.players[pid];
      // Only players who finished can win
      if (p.finished && p.score > bestScore) {
        bestScore = p.score;
        bestPlayer = pid;
      }
    }
    return bestPlayer;
  }

  /**
   * WHY scoring rewards completion over collection: A player who finishes
   * the level with fewer coins beats one who collected everything but died.
   * This prioritizes the primary objective (reach the exit) while still
   * rewarding the secondary objective (collect items). The time bonus
   * creates a third axis of competition for advanced players.
   */
  protected calculateScores(): Record<string, number> {
    const data = this.getData<PlatformerState>();
    const scores: Record<string, number> = {};

    for (const pid of this.getPlayers()) {
      const p = data.players[pid];
      const completionBonus = p.finished ? 1000 : 0;
      const livesBonus = p.lives * 200;
      scores[pid] = p.score + completionBonus + livesBonus;
    }

    return scores;
  }

  // =====================
  // LEVEL GENERATION
  // =====================

  /**
   * Generate platforms for the level.
   * WHY structured generation: Purely random platforms create unplayable
   * levels. These platforms follow rules: ground floor exists, gaps are
   * jumpable, higher platforms are reachable. This guarantees the level
   * is completable while still feeling varied.
   */
  private generatePlatforms(): Platform[] {
    const platforms: Platform[] = [];

    // Ground floor with gaps
    for (let x = 0; x < this.LEVEL_WIDTH; x += 8) {
      const gapChance = x > 10 ? 0.3 : 0; // No gaps near spawn
      if (Math.abs(Math.sin(x * 0.7)) > gapChance) {
        platforms.push({
          x,
          y: this.LEVEL_HEIGHT - 2,
          width: 6 + (x % 3),
          height: 2,
        });
      }
    }

    // Elevated platforms for exploration
    for (let x = 10; x < this.LEVEL_WIDTH - 10; x += 12) {
      const heightOffset = 6 + (x % 5);
      platforms.push({
        x: x + (x % 4),
        y: this.LEVEL_HEIGHT - heightOffset,
        width: 3 + (x % 3),
        height: 1,
      });
    }

    return platforms;
  }

  private generateCollectibles(): Collectible[] {
    const collectibles: Collectible[] = [];
    let id = 1;

    // Coins along the main path
    for (let x = 5; x < this.LEVEL_WIDTH - 5; x += 3) {
      collectibles.push({
        id: id++,
        x,
        y: this.LEVEL_HEIGHT - 4,
        type: 'coin',
        value: 10,
        collected: false,
      });
    }

    // Gems on elevated platforms (worth more, harder to reach)
    for (let x = 15; x < this.LEVEL_WIDTH - 10; x += 15) {
      collectibles.push({
        id: id++,
        x: x + 1,
        y: this.LEVEL_HEIGHT - 10,
        type: 'gem',
        value: 50,
        collected: false,
      });
    }

    return collectibles;
  }

  private generateHazards(density = 1.0): Hazard[] {
    const hazards: Hazard[] = [];
    let id = 1;

    // Spike spacing: lower density = fewer spikes (wider spacing), higher = more
    const spikeStep = Math.max(6, Math.round(18 / density));
    for (let x = 20; x < this.LEVEL_WIDTH - 20; x += spikeStep) {
      hazards.push({
        id: id++,
        x,
        y: this.LEVEL_HEIGHT - 1,
        width: 3,
        height: 1,
        type: 'spikes',
      });
    }

    // Moving enemy spacing
    const enemyStep = Math.max(8, Math.round(25 / density));
    for (let x = 30; x < this.LEVEL_WIDTH - 15; x += enemyStep) {
      hazards.push({
        id: id++,
        x,
        y: this.LEVEL_HEIGHT - 4,
        width: 1,
        height: 1,
        type: 'moving_enemy',
        moveSpeed: 0.3,
        moveRange: 4,
        moveOffset: 0,
      });
    }

    return hazards;
  }

  private generateCheckpoints(): Checkpoint[] {
    const checkpoints: Checkpoint[] = [];

    // Place checkpoints at roughly 1/3 and 2/3 of the level
    checkpoints.push({
      x: Math.floor(this.LEVEL_WIDTH / 3),
      y: this.LEVEL_HEIGHT - 4,
      activated: false,
    });
    checkpoints.push({
      x: Math.floor((this.LEVEL_WIDTH * 2) / 3),
      y: this.LEVEL_HEIGHT - 4,
      activated: false,
    });

    return checkpoints;
  }
}
