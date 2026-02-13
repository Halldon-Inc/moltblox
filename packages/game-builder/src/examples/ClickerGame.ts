/**
 * ClickerGame - A complete example game
 *
 * Race to reach the target click count first!
 * Demonstrates:
 * - Multiplayer support
 * - Turn-based actions
 * - Scoring
 * - Win conditions
 *
 * This is a ~100 line complete game that bots can study and modify.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface ClickerConfig {
  targetClicks?: number;
  clickValue?: number;
}

interface ClickerState {
  [key: string]: unknown;
  clicks: Record<string, number>; // Player ID -> click count
  targetClicks: number; // First to reach this wins
  lastAction: string | null; // Last player who acted
}

export class ClickerGame extends BaseGame {
  // Metadata
  readonly name = 'Click Race';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  /**
   * Initialize game state
   */
  protected initializeState(playerIds: string[]): ClickerState {
    const cfg = this.config as ClickerConfig;
    const targetClicks = cfg.targetClicks ?? 100;

    // Create click counters for each player
    const clicks: Record<string, number> = {};
    for (const playerId of playerIds) {
      clicks[playerId] = 0;
    }

    return {
      clicks,
      targetClicks,
      lastAction: null,
    };
  }

  /**
   * Handle player actions
   */
  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ClickerState>();

    switch (action.type) {
      case 'click': {
        // Increment click count by configured value
        const cfg = this.config as ClickerConfig;
        data.clicks[playerId] += cfg.clickValue ?? 1;
        data.lastAction = playerId;

        // Emit event for click milestones
        const clicks = data.clicks[playerId];
        if (clicks % 10 === 0) {
          this.emitEvent('milestone', playerId, { clicks });
        }

        // Update state
        this.setData(data);

        return {
          success: true,
          newState: this.getState(),
        };
      }

      case 'multi_click': {
        // Power-up: multiple clicks at once (if purchased)
        const amount = Number(action.payload.amount || action.payload.count) || 1;
        data.clicks[playerId] += Math.min(amount, 100); // Max 100 per action
        data.lastAction = playerId;
        this.setData(data);

        return {
          success: true,
          newState: this.getState(),
        };
      }

      default:
        return {
          success: false,
          error: `Unknown action: ${action.type}`,
        };
    }
  }

  /**
   * Check if game is over
   */
  protected checkGameOver(): boolean {
    const data = this.getData<ClickerState>();

    // Game ends when someone reaches target
    for (const playerId of this.getPlayers()) {
      if (data.clicks[playerId] >= data.targetClicks) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine the winner
   */
  protected determineWinner(): string | null {
    const data = this.getData<ClickerState>();

    // Winner is whoever reached target first
    for (const playerId of this.getPlayers()) {
      if (data.clicks[playerId] >= data.targetClicks) {
        return playerId;
      }
    }

    return null;
  }

  /**
   * Calculate scores
   */
  protected calculateScores(): Record<string, number> {
    const data = this.getData<ClickerState>();
    return { ...data.clicks };
  }

  /**
   * Override to hide other players' exact counts (fog of war)
   */
  getStateForPlayer(playerId: string): typeof this.state {
    const fullState = this.getState();
    const data = fullState.data as ClickerState;

    // Show own clicks, but only relative position for others
    const myClicks = data.clicks[playerId];
    const maskedClicks: Record<string, number | string> = {};

    for (const [id, clicks] of Object.entries(data.clicks)) {
      if (id === playerId) {
        maskedClicks[id] = clicks;
      } else {
        // Show "ahead", "behind", or "tied"
        if (clicks > myClicks) {
          maskedClicks[id] = 'ahead';
        } else if (clicks < myClicks) {
          maskedClicks[id] = 'behind';
        } else {
          maskedClicks[id] = 'tied';
        }
      }
    }

    return {
      ...fullState,
      data: {
        ...data,
        clicks: maskedClicks as Record<string, number>,
      },
    };
  }
}
