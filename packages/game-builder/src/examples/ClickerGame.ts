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
  /** Turns within which consecutive clicks count as a combo (1-10, default 0 = disabled). */
  comboWindow?: number;
  /** Emit milestone event every N clicks (default 10). */
  milestoneEvery?: number;
  /** Clicks lost per turn of inactivity (0 = disabled, default 0). */
  decayRate?: number;
  /** Maximum clicks allowed per multi_click action (default 10). */
  maxMultiClick?: number;
  secondaryMechanic?: 'rhythm' | 'puzzle' | 'timing' | 'resource';

  /** Visual theming options. */
  theme?: {
    /** Main click button color (CSS, default '#4CAF50'). */
    buttonColor?: string;
    /** Particle burst colors on click (CSS array, default ['#FFD700','#FF6347','#00CED1']). */
    particleColors?: string[];
    /** Progress bar gradient colors [start, end] (CSS, default ['#4CAF50','#8BC34A']). */
    progressBarColors?: [string, string];
  };

  /** Gameplay tuning options. */
  gameplay?: {
    /** Base cost for each upgrade type, keyed by upgrade name (default: click_power=10, auto_click=25, multi_click_size=15). */
    upgradeCosts?: Partial<Record<'click_power' | 'auto_click' | 'multi_click_size', number>>;
    /** Combo multiplier scale: each combo level adds this fraction (default 0.1). */
    comboMultiplierScale?: number;
  };

  /** Content customization options. */
  content?: {
    /** Display names for upgrade types (default: click_power='Click Power', auto_click='Auto Click', multi_click_size='Multi Click'). */
    upgradeNames?: Partial<Record<'click_power' | 'auto_click' | 'multi_click_size', string>>;
  };
}

interface UpgradeLevels {
  click_power: number; // Each level adds +1 to base click value
  auto_click: number; // Each level adds +1 passive clicks per turn
  multi_click_size: number; // Each level adds +5 to max multi_click
}

const DEFAULT_UPGRADE_BASE_COSTS: Record<keyof UpgradeLevels, number> = {
  click_power: 10,
  auto_click: 25,
  multi_click_size: 15,
};

const DEFAULT_COMBO_MULTIPLIER_SCALE = 0.1;

interface ClickerState {
  [key: string]: unknown;
  clicks: Record<string, number>; // Player ID -> click count
  targetClicks: number; // First to reach this wins
  lastAction: string | null; // Last player who acted
  lastClickTurn: Record<string, number>; // Turn of each player's last click (for combo/decay)
  combos: Record<string, number>; // Current combo streak per player
  upgrades: Record<string, UpgradeLevels>; // Upgrade levels per player
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

    const lastClickTurn: Record<string, number> = {};
    const combos: Record<string, number> = {};
    for (const playerId of playerIds) {
      lastClickTurn[playerId] = -1;
      combos[playerId] = 0;
    }

    const upgrades: Record<string, UpgradeLevels> = {};
    for (const playerId of playerIds) {
      upgrades[playerId] = { click_power: 0, auto_click: 0, multi_click_size: 0 };
    }

    return {
      clicks,
      targetClicks,
      lastAction: null,
      lastClickTurn,
      combos,
      upgrades,
    };
  }

  /**
   * Handle player actions
   */
  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<ClickerState>();

    switch (action.type) {
      case 'click': {
        const cfg = this.config as ClickerConfig;
        const currentTurn = this.getTurn();
        const comboWindow = cfg.comboWindow ?? 0;
        const milestoneEvery = cfg.milestoneEvery ?? 10;
        const decayRate = cfg.decayRate ?? 0;

        // Apply decay: if player hasn't clicked within comboWindow turns, lose clicks
        if (decayRate > 0 && data.lastClickTurn[playerId] >= 0) {
          const turnsSinceLast = currentTurn - data.lastClickTurn[playerId];
          if (turnsSinceLast > 1) {
            const decayAmount = (turnsSinceLast - 1) * decayRate;
            data.clicks[playerId] = Math.max(0, data.clicks[playerId] - decayAmount);
          }
        }

        // Track combo
        if (comboWindow > 0) {
          const turnsSinceLast = currentTurn - data.lastClickTurn[playerId];
          if (turnsSinceLast <= comboWindow && data.lastClickTurn[playerId] >= 0) {
            data.combos[playerId]++;
          } else {
            data.combos[playerId] = 1;
          }
        }

        // Increment click count by configured value + upgrade bonus, scaled by combo multiplier
        const playerUpgrades = data.upgrades[playerId];
        const baseClick = (cfg.clickValue ?? 1) + (playerUpgrades?.click_power ?? 0);
        const comboScale =
          (cfg.gameplay?.comboMultiplierScale as number) ?? DEFAULT_COMBO_MULTIPLIER_SCALE;
        const comboMultiplier =
          comboWindow > 0 && data.combos[playerId] > 1 ? 1 + data.combos[playerId] * comboScale : 1;
        const autoClickBonus = playerUpgrades?.auto_click ?? 0;
        const clickAmount = Math.floor(baseClick * comboMultiplier) + autoClickBonus;
        data.clicks[playerId] += clickAmount;
        data.lastAction = playerId;
        data.lastClickTurn[playerId] = currentTurn;

        // Emit event for click milestones
        const clicks = data.clicks[playerId];
        if (milestoneEvery > 0 && clicks % milestoneEvery === 0) {
          this.emitEvent('milestone', playerId, { clicks });
        }

        this.setData(data);

        return {
          success: true,
          newState: this.getState(),
        };
      }

      case 'multi_click': {
        // Power-up: multiple clicks at once (if purchased)
        const mcCfg = this.config as ClickerConfig;
        const mcDecay = mcCfg.decayRate ?? 0;

        // Apply decay before adding clicks
        if (mcDecay > 0) {
          data.clicks[playerId] = Math.max(0, data.clicks[playerId] - mcDecay);
        }

        const amount = Number(action.payload.amount || action.payload.count) || 1;
        const mcUpgrade = data.upgrades[playerId]?.multi_click_size ?? 0;
        const mcMax = (mcCfg.maxMultiClick ?? 10) + mcUpgrade * 5;

        if (amount > mcMax) {
          return {
            success: false,
            error: `multi_click amount ${amount} exceeds maximum of ${mcMax}`,
          };
        }

        data.clicks[playerId] += amount;
        data.lastAction = playerId;
        this.setData(data);

        return {
          success: true,
          newState: this.getState(),
        };
      }

      case 'upgrade': {
        const upgradeType = (action.payload?.upgradeType ?? action.payload?.type) as
          | keyof UpgradeLevels
          | undefined;

        if (!upgradeType || !(upgradeType in DEFAULT_UPGRADE_BASE_COSTS)) {
          return {
            success: false,
            error: `Invalid upgrade type: "${upgradeType}". Valid types: click_power, auto_click, multi_click_size`,
          };
        }

        const upgCfg = this.config as ClickerConfig;
        const baseCosts = {
          ...DEFAULT_UPGRADE_BASE_COSTS,
          ...(upgCfg.gameplay?.upgradeCosts as Partial<Record<keyof UpgradeLevels, number>>),
        };
        const playerUpg = data.upgrades[playerId] ?? {
          click_power: 0,
          auto_click: 0,
          multi_click_size: 0,
        };
        const currentLevel = playerUpg[upgradeType];
        const cost = baseCosts[upgradeType] * Math.pow(2, currentLevel);

        if (data.clicks[playerId] < cost) {
          return {
            success: false,
            error: `Not enough clicks. Need ${cost}, have ${data.clicks[playerId]}`,
          };
        }

        data.clicks[playerId] -= cost;
        playerUpg[upgradeType] = currentLevel + 1;
        data.upgrades[playerId] = playerUpg;
        data.lastAction = playerId;
        this.setData(data);

        this.emitEvent('upgrade', playerId, {
          upgradeType,
          newLevel: currentLevel + 1,
          cost,
        });

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
