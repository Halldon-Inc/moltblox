/**
 * StateMachineGame: A JSON-driven state machine game template
 *
 * Bots define game logic as structured data (states, resources, actions,
 * transitions, win/lose conditions) and this engine executes it safely
 * with no eval() or arbitrary code execution.
 *
 * Supports single-player and 2-player turn-based modes.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// ---------------------------------------------------------------------------
// Public types for the state machine definition
// ---------------------------------------------------------------------------

export interface StateMachineDefinition {
  name: string;
  description: string;
  states: StateDef[];
  initialState: string;
  resources: Record<string, ResourceDef>;
  actions: Record<string, ActionDef[]>;
  transitions: TransitionDef[];
  winCondition: ConditionExpr;
  loseCondition: ConditionExpr;
  perTurnEffects?: EffectDef[];
  theme?: ThemeDef;
}

export interface StateDef {
  name: string;
  description?: string;
  onEnter?: EffectDef[];
}

export interface ResourceDef {
  initial: number;
  min?: number;
  max?: number;
  label?: string;
}

export interface ActionDef {
  name: string;
  label?: string;
  description?: string;
  condition?: ConditionExpr;
  effects: EffectDef[];
  transition?: string;
}

export interface EffectDef {
  resource: string;
  operation: '+' | '-' | '*' | '/';
  value: string;
}

export interface TransitionDef {
  from: string;
  to: string;
  condition: ConditionExpr;
  auto?: boolean;
}

export type ConditionExpr =
  | { resource: string; operator: '>' | '<' | '>=' | '<=' | '==' | '!='; value: string }
  | { and: ConditionExpr[] }
  | { or: ConditionExpr[] }
  | { state: string };

export interface ThemeDef {
  palette?: string;
  stateDescriptions?: Record<string, { label?: string; icon?: string; bgColor?: string }>;
  resourceIcons?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Config interface
// ---------------------------------------------------------------------------

export interface StateMachineConfig {
  definition: StateMachineDefinition;
}

// ---------------------------------------------------------------------------
// Internal state shape stored in GameState.data
// ---------------------------------------------------------------------------

interface SMState {
  [key: string]: unknown;
  currentState: string;
  resources: Record<string, number>;
  currentPlayerIndex: number;
  turnCount: number;
  gameResult: 'playing' | 'win' | 'lose';
  definition: StateMachineDefinition;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const MAX_STATES = 30;
const MAX_RESOURCES = 15;
const MAX_ACTIONS_PER_STATE = 15;
const MAX_AUTO_TRANSITIONS = 50; // guard against infinite loops

// ---------------------------------------------------------------------------
// Expression Evaluator (safe, no code execution)
// ---------------------------------------------------------------------------

const RANDOM_RE = /^random\((-?\d+),(-?\d+)\)$/;
// eslint-disable-next-line security/detect-unsafe-regex
const RESOURCE_MATH_RE = /^@([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/;
// eslint-disable-next-line security/detect-unsafe-regex
const RESOURCE_REF_RE = /^@([a-zA-Z_][a-zA-Z0-9_]*)$/;
// eslint-disable-next-line security/detect-unsafe-regex
const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

export function evaluateExpression(expr: string, resources: Record<string, number>): number {
  const trimmed = expr.trim();

  // Number literal
  if (NUMBER_RE.test(trimmed)) {
    return Number(trimmed);
  }

  // random(min,max)
  const randomMatch = trimmed.match(RANDOM_RE);
  if (randomMatch) {
    const min = parseInt(randomMatch[1], 10);
    const max = parseInt(randomMatch[2], 10);
    if (min > max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Resource reference with math: @hp+5, @gold*2
  const mathMatch = trimmed.match(RESOURCE_MATH_RE);
  if (mathMatch) {
    const resName = mathMatch[1];
    const op = mathMatch[2];
    const operand = Number(mathMatch[3]);
    const resValue = resources[resName] ?? 0;
    switch (op) {
      case '+':
        return resValue + operand;
      case '-':
        return resValue - operand;
      case '*':
        return resValue * operand;
      case '/':
        return operand === 0 ? resValue : resValue / operand;
      default:
        return resValue;
    }
  }

  // Simple resource reference: @hp
  const refMatch = trimmed.match(RESOURCE_REF_RE);
  if (refMatch) {
    return resources[refMatch[1]] ?? 0;
  }

  // Unrecognized expression: return 0
  return 0;
}

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(
  cond: ConditionExpr,
  resources: Record<string, number>,
  currentState: string,
): boolean {
  if ('and' in cond) {
    return cond.and.every((c) => evaluateCondition(c, resources, currentState));
  }
  if ('or' in cond) {
    return cond.or.some((c) => evaluateCondition(c, resources, currentState));
  }
  if ('state' in cond) {
    return currentState === cond.state;
  }

  // Resource comparison
  const resValue = resources[cond.resource] ?? 0;
  const target = evaluateExpression(cond.value, resources);
  switch (cond.operator) {
    case '>':
      return resValue > target;
    case '<':
      return resValue < target;
    case '>=':
      return resValue >= target;
    case '<=':
      return resValue <= target;
    case '==':
      return resValue === target;
    case '!=':
      return resValue !== target;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Apply effects
// ---------------------------------------------------------------------------

function applyEffects(
  effects: EffectDef[],
  resources: Record<string, number>,
  resourceDefs: Record<string, ResourceDef>,
): void {
  for (const effect of effects) {
    const current = resources[effect.resource] ?? 0;
    const val = evaluateExpression(effect.value, resources);
    let result: number;
    switch (effect.operation) {
      case '+':
        result = current + val;
        break;
      case '-':
        result = current - val;
        break;
      case '*':
        result = current * val;
        break;
      case '/':
        result = val === 0 ? current : current / val;
        break;
      default:
        result = current;
    }

    // Clamp to min/max
    const def = resourceDefs[effect.resource];
    if (def) {
      if (def.min !== undefined && result < def.min) result = def.min;
      if (def.max !== undefined && result > def.max) result = def.max;
    }

    resources[effect.resource] = result;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDefinition(def: StateMachineDefinition): void {
  if (def.states.length > MAX_STATES) {
    throw new Error(`Too many states: ${def.states.length} (max ${MAX_STATES})`);
  }

  const resourceCount = Object.keys(def.resources).length;
  if (resourceCount > MAX_RESOURCES) {
    throw new Error(`Too many resources: ${resourceCount} (max ${MAX_RESOURCES})`);
  }

  const stateNames = new Set(def.states.map((s) => s.name));

  if (!stateNames.has(def.initialState)) {
    throw new Error(`Initial state "${def.initialState}" not found in states`);
  }

  for (const [stateName, actions] of Object.entries(def.actions)) {
    if (!stateNames.has(stateName)) {
      throw new Error(`Actions defined for unknown state "${stateName}"`);
    }
    if (actions.length > MAX_ACTIONS_PER_STATE) {
      throw new Error(
        `Too many actions for state "${stateName}": ${actions.length} (max ${MAX_ACTIONS_PER_STATE})`,
      );
    }
  }

  for (const t of def.transitions) {
    if (!stateNames.has(t.from)) {
      throw new Error(`Transition references unknown state "${t.from}"`);
    }
    if (!stateNames.has(t.to)) {
      throw new Error(`Transition references unknown state "${t.to}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// StateMachineGame class
// ---------------------------------------------------------------------------

export class StateMachineGame extends BaseGame {
  readonly name: string;
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  private definition: StateMachineDefinition;

  constructor(config?: Record<string, unknown>) {
    super(config);
    const cfg = config as unknown as StateMachineConfig | undefined;
    if (!cfg?.definition) {
      throw new Error('StateMachineGame requires a definition in config');
    }
    this.definition = cfg.definition;
    this.name = this.definition.name || 'State Machine Game';
    validateDefinition(this.definition);
  }

  protected initializeState(playerIds: string[]): SMState {
    const resources: Record<string, number> = {};
    for (const [name, def] of Object.entries(this.definition.resources)) {
      resources[name] = def.initial;
    }

    const state: SMState = {
      currentState: this.definition.initialState,
      resources,
      currentPlayerIndex: 0,
      turnCount: 0,
      gameResult: 'playing',
      definition: this.definition,
    };

    // Run onEnter effects for initial state
    const initialStateDef = this.definition.states.find(
      (s) => s.name === this.definition.initialState,
    );
    if (initialStateDef?.onEnter) {
      applyEffects(initialStateDef.onEnter, state.resources, this.definition.resources);
    }

    return state;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SMState>();

    // In multiplayer, check it is this player's turn
    if (this.getPlayerCount() > 1) {
      const expectedPlayer = this.getPlayers()[data.currentPlayerIndex];
      if (playerId !== expectedPlayer) {
        return { success: false, error: 'Not your turn' };
      }
    }

    if (data.gameResult !== 'playing') {
      return { success: false, error: 'Game already ended' };
    }

    const actionType = action.type;
    const stateActions = this.definition.actions[data.currentState] ?? [];
    const actionDef = stateActions.find((a) => a.name === actionType);

    if (!actionDef) {
      return {
        success: false,
        error: `Action "${actionType}" not available in state "${data.currentState}"`,
      };
    }

    // Check action condition
    if (actionDef.condition) {
      if (!evaluateCondition(actionDef.condition, data.resources, data.currentState)) {
        return { success: false, error: `Condition not met for action "${actionType}"` };
      }
    }

    // Apply action effects
    applyEffects(actionDef.effects, data.resources, this.definition.resources);

    // If action has a transition target, move to new state
    if (actionDef.transition) {
      this.transitionTo(data, actionDef.transition);
    }

    // Check auto-transitions
    this.processAutoTransitions(data);

    // Apply per-turn effects
    if (this.definition.perTurnEffects) {
      applyEffects(this.definition.perTurnEffects, data.resources, this.definition.resources);
    }

    // Check win/lose
    if (evaluateCondition(this.definition.winCondition, data.resources, data.currentState)) {
      data.gameResult = 'win';
      this.emitEvent('game_won', playerId, { resources: { ...data.resources } });
    } else if (
      evaluateCondition(this.definition.loseCondition, data.resources, data.currentState)
    ) {
      data.gameResult = 'lose';
      this.emitEvent('game_lost', playerId, { resources: { ...data.resources } });
    }

    // Advance turn
    data.turnCount++;
    if (this.getPlayerCount() > 1) {
      data.currentPlayerIndex = (data.currentPlayerIndex + 1) % this.getPlayerCount();
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<SMState>();
    return data.gameResult !== 'playing';
  }

  protected determineWinner(): string | null {
    const data = this.getData<SMState>();
    if (data.gameResult === 'win') {
      // In single-player, the player wins. In multiplayer, the current player
      // (who just acted) is the winner. currentPlayerIndex already advanced,
      // so step back one.
      if (this.getPlayerCount() === 1) {
        return this.getPlayers()[0];
      }
      const winnerIdx =
        (data.currentPlayerIndex - 1 + this.getPlayerCount()) % this.getPlayerCount();
      return this.getPlayers()[winnerIdx];
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SMState>();
    const scores: Record<string, number> = {};
    const totalResources = Object.values(data.resources).reduce((a, b) => a + b, 0);
    for (const pid of this.getPlayers()) {
      scores[pid] = totalResources;
    }
    return scores;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private transitionTo(data: SMState, targetState: string): void {
    data.currentState = targetState;
    const stateDef = this.definition.states.find((s) => s.name === targetState);
    if (stateDef?.onEnter) {
      applyEffects(stateDef.onEnter, data.resources, this.definition.resources);
    }
    this.emitEvent('state_changed', undefined, { newState: targetState });
  }

  private processAutoTransitions(data: SMState): void {
    let iterations = 0;
    while (iterations < MAX_AUTO_TRANSITIONS) {
      const triggered = this.definition.transitions.find(
        (t) =>
          t.auto &&
          t.from === data.currentState &&
          evaluateCondition(t.condition, data.resources, data.currentState),
      );
      if (!triggered) break;
      this.transitionTo(data, triggered.to);
      iterations++;
    }
  }
}
