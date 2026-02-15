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
// Normalization: convert simplified/alternative schema to internal format
// ---------------------------------------------------------------------------

/**
 * Normalizes a simplified state-machine definition (as sent by MCP bots)
 * into the full StateMachineDefinition format the engine expects.
 *
 * Handles:
 * - actions as string arrays: { start: ["explore"] } => { start: [{ name: "explore", effects: [] }] }
 * - resources as plain numbers: { gold: 0 } => { gold: { initial: 0 } }
 * - action-based transitions: { from, action, to, effects } => merged into ActionDef
 * - winConditions/loseConditions arrays => single ConditionExpr
 * - effect shorthand: { type: "modify_resource", resource, amount } => { resource, operation: "+", value }
 */
function normalizeDefinition(def: Record<string, unknown>): StateMachineDefinition {
  const out = { ...def } as Record<string, unknown>;

  // --- Normalize resources: number => ResourceDef ---
  if (out.resources && typeof out.resources === 'object' && !Array.isArray(out.resources)) {
    const resources = out.resources as Record<string, unknown>;
    const normalized: Record<string, ResourceDef> = {};
    for (const [key, val] of Object.entries(resources)) {
      if (typeof val === 'number') {
        normalized[key] = { initial: val };
      } else if (val && typeof val === 'object' && 'initial' in (val as Record<string, unknown>)) {
        normalized[key] = val as ResourceDef;
      } else {
        normalized[key] = { initial: 0 };
      }
    }
    out.resources = normalized;
  }

  // --- Collect action-based transitions (simplified format) ---
  // These have an "action" field and map to ActionDef.transition + effects
  const actionTransitions = new Map<string, Map<string, { to: string; effects: EffectDef[] }>>();
  if (Array.isArray(out.transitions)) {
    const rawTransitions = out.transitions as Array<Record<string, unknown>>;
    const cleanTransitions: TransitionDef[] = [];
    for (const t of rawTransitions) {
      if (typeof t.action === 'string') {
        // Action-based transition: merge into the ActionDef
        const from = String(t.from);
        const actionName = String(t.action);
        if (!actionTransitions.has(from)) {
          actionTransitions.set(from, new Map());
        }
        const effects = normalizeEffects((t.effects as Array<Record<string, unknown>>) ?? []);
        actionTransitions.get(from)!.set(actionName, {
          to: String(t.to),
          effects,
        });
      } else if (t.condition && typeof t.condition === 'object') {
        // Standard condition-based transition: keep as-is
        cleanTransitions.push(t as unknown as TransitionDef);
      }
    }
    out.transitions = cleanTransitions;
  }

  // --- Normalize actions: string[] => ActionDef[] ---
  if (out.actions && typeof out.actions === 'object') {
    const actions = out.actions as Record<string, unknown>;
    const normalized: Record<string, ActionDef[]> = {};
    for (const [stateName, val] of Object.entries(actions)) {
      if (Array.isArray(val)) {
        normalized[stateName] = val.map((item) => {
          if (typeof item === 'string') {
            // Simplified: just an action name string
            const transInfo = actionTransitions.get(stateName)?.get(item);
            return {
              name: item,
              effects: transInfo?.effects ?? [],
              transition: transInfo?.to,
            } as ActionDef;
          } else if (item && typeof item === 'object' && 'name' in item) {
            // Full ActionDef object: normalize effects if needed
            const actionObj = item as Record<string, unknown>;
            const result: ActionDef = {
              name: String(actionObj.name),
              effects: normalizeEffects(
                (actionObj.effects as Array<Record<string, unknown>>) ?? [],
              ),
            };
            if (actionObj.label) result.label = String(actionObj.label);
            if (actionObj.description) result.description = String(actionObj.description);
            if (actionObj.transition) result.transition = String(actionObj.transition);
            if (actionObj.condition) result.condition = actionObj.condition as ConditionExpr;
            // Merge action-based transition if not already set
            if (!result.transition) {
              const transInfo = actionTransitions.get(stateName)?.get(result.name);
              if (transInfo) {
                result.transition = transInfo.to;
                if (result.effects.length === 0) {
                  result.effects = transInfo.effects;
                }
              }
            }
            return result;
          }
          return { name: String(item), effects: [] } as ActionDef;
        });
      } else {
        normalized[stateName] = [];
      }
    }
    out.actions = normalized;

    // Synthesize action entries for states that have action-based transitions
    // but were not listed in the actions map. This handles the common case where
    // bots define transitions with { from, action, to, effects } but forget to
    // also list those action names in the actions map for the source state.
    for (const [stateName, actionMap] of actionTransitions) {
      if (!normalized[stateName]) {
        normalized[stateName] = [];
      }
      for (const [actionName, transInfo] of actionMap) {
        const exists = normalized[stateName].some((a) => a.name === actionName);
        if (!exists) {
          normalized[stateName].push({
            name: actionName,
            effects: transInfo.effects,
            transition: transInfo.to,
          } as ActionDef);
        }
      }
    }
  }

  // If no actions map exists at all, build one entirely from action-based transitions
  if (!out.actions && actionTransitions.size > 0) {
    const synthesized: Record<string, ActionDef[]> = {};
    for (const [stateName, actionMap] of actionTransitions) {
      synthesized[stateName] = [];
      for (const [actionName, transInfo] of actionMap) {
        synthesized[stateName].push({
          name: actionName,
          effects: transInfo.effects,
          transition: transInfo.to,
        } as ActionDef);
      }
    }
    out.actions = synthesized;
  }

  // --- Normalize winConditions (array) => winCondition (single) ---
  if (Array.isArray(out.winConditions) && !out.winCondition) {
    out.winCondition = normalizeConditionArray(
      out.winConditions as Array<Record<string, unknown>>,
      '>=',
    );
    delete out.winConditions;
  }
  // Provide a default that never triggers if missing
  if (!out.winCondition) {
    out.winCondition = { resource: '__never__', operator: '==', value: '-999' };
  }

  // --- Normalize loseConditions (array) => loseCondition (single) ---
  if (Array.isArray(out.loseConditions) && !out.loseCondition) {
    out.loseCondition = normalizeConditionArray(
      out.loseConditions as Array<Record<string, unknown>>,
      '<=',
    );
    delete out.loseConditions;
  }
  // Provide a default that never triggers if missing
  if (!out.loseCondition) {
    out.loseCondition = { resource: '__never__', operator: '==', value: '-999' };
  }

  return out as unknown as StateMachineDefinition;
}

/**
 * Normalize an array of condition objects (simplified format) into a single ConditionExpr.
 * Handles: { type: "resource_threshold", resource, threshold } => { resource, operator, value }
 * defaultOp: ">=" for win conditions ("win when resource reaches threshold"),
 *            "<=" for lose conditions ("lose when resource drops to threshold")
 */
function normalizeConditionArray(
  conditions: Array<Record<string, unknown>>,
  defaultOp: '>=' | '<=' = '>=',
): ConditionExpr {
  const exprs: ConditionExpr[] = conditions.map((c) => {
    if (c.type === 'resource_threshold') {
      return {
        resource: String(c.resource),
        operator: defaultOp,
        value: String(c.threshold ?? 0),
      };
    }
    if (c.type === 'state') {
      return { state: String(c.state) };
    }
    // Already a valid ConditionExpr
    if (c.resource && c.operator) {
      return c as unknown as ConditionExpr;
    }
    // Fallback: never-true condition
    return { resource: '__never__', operator: '==' as const, value: '-999' };
  });

  if (exprs.length === 0) {
    return { resource: '__never__', operator: '==', value: '-999' };
  }
  if (exprs.length === 1) {
    return exprs[0];
  }
  return { and: exprs };
}

/**
 * Normalize effect objects from simplified format to internal EffectDef.
 * Handles: { type: "modify_resource", resource, amount } => { resource, operation: "+"/"-", value }
 */
function normalizeEffects(effects: Array<Record<string, unknown>>): EffectDef[] {
  return effects.map((e) => {
    // Already in internal format
    if (typeof e.operation === 'string' && typeof e.value === 'string') {
      return e as unknown as EffectDef;
    }
    // Simplified format: { type: "modify_resource", resource, amount }
    if (e.type === 'modify_resource' || e.resource) {
      const amount = Number(e.amount ?? e.value ?? 0);
      return {
        resource: String(e.resource),
        operation: (amount >= 0 ? '+' : '-') as '+' | '-',
        value: String(Math.abs(amount)),
      };
    }
    // Fallback: no-op effect
    return { resource: '__noop__', operation: '+' as const, value: '0' };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDefinition(def: StateMachineDefinition): void {
  if (!Array.isArray(def.states) || def.states.length === 0) {
    const defKeys = def ? Object.keys(def) : [];
    const statesType = def?.states === undefined ? 'undefined' : typeof def.states;
    const preview = JSON.stringify(def).slice(0, 200);
    throw new Error(
      `Definition must have at least one state. ` +
        `definition keys: [${defKeys.join(', ')}], ` +
        `states type: ${statesType}, ` +
        `preview: ${preview}`,
    );
  }
  if (def.states.length > MAX_STATES) {
    throw new Error(`Too many states: ${def.states.length} (max ${MAX_STATES})`);
  }

  if (!def.resources || typeof def.resources !== 'object') {
    throw new Error('Definition must have a resources object (e.g. { hp: { initial: 10 } })');
  }
  const resourceCount = Object.keys(def.resources).length;
  if (resourceCount > MAX_RESOURCES) {
    throw new Error(`Too many resources: ${resourceCount} (max ${MAX_RESOURCES})`);
  }

  if (!def.actions || typeof def.actions !== 'object') {
    throw new Error('Definition must have an actions object mapping state names to action arrays');
  }

  if (!def.initialState) {
    throw new Error('Definition must have an initialState');
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

    let definition: StateMachineDefinition | undefined;
    const raw = config as Record<string, unknown> | undefined;

    if (raw?.definition && typeof raw.definition === 'object') {
      let candidate = raw.definition as Record<string, unknown>;
      // Unwrap double-wrapped config: { definition: { definition: { ... } } }
      if (
        candidate.definition &&
        typeof candidate.definition === 'object' &&
        !Array.isArray(candidate.definition) &&
        !('states' in candidate)
      ) {
        candidate = candidate.definition as Record<string, unknown>;
      }
      definition = candidate as unknown as StateMachineDefinition;
    } else if (raw && ('states' in raw || 'initialState' in raw || 'resources' in raw)) {
      // Flat format: the config IS the definition (no wrapper)
      definition = raw as unknown as StateMachineDefinition;
    }

    if (!definition) {
      const keys = raw ? Object.keys(raw) : [];
      const preview = raw ? JSON.stringify(raw).slice(0, 200) : 'undefined';
      throw new Error(
        `StateMachineGame requires a definition in config. ` +
          `Received keys: [${keys.join(', ')}]. ` +
          `Preview: ${preview}. ` +
          `Expected: { definition: { name, states, initialState, resources, actions, transitions, winCondition, loseCondition } }`,
      );
    }

    // Normalize simplified/alternative schemas (MCP bot format) into internal format
    this.definition = normalizeDefinition(definition as unknown as Record<string, unknown>);
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
