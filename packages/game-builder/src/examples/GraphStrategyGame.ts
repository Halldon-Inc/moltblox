/**
 * GraphStrategyGame - Directed graph strategy
 *
 * Players place signals on nodes they control. Signals propagate along
 * directed edges each turn, decaying by signalDecay. Nodes become
 * controlled when signal strength exceeds a threshold.
 * Win by controlling all nodes (instant) or most nodes when maxTurns reached.
 * Actions: place_signal, redirect_edge, fortify_node.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface GraphStrategyConfig {
  nodeCount?: number;
  edgeDensity?: number;
  signalDecay?: number;
  maxTurns?: number;
}

interface GraphNode {
  id: number;
  signals: Record<string, number>;
  controller: string | null;
  fortified: boolean;
  [key: string]: unknown;
}

interface GraphEdge {
  from: number;
  to: number;
  [key: string]: unknown;
}

interface GSState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  signalDecay: number;
  maxTurns: number;
  currentTurn: number;
  turnOrder: string[];
  currentPlayerIndex: number;
  actionsPerTurn: number;
  actionsThisTurn: number;
  controlThreshold: number;
  gameResult: 'playing' | 'ended';
  nodeCount: number;
  [key: string]: unknown;
}

const CONTROL_THRESHOLD = 3.0;
const ACTIONS_PER_TURN = 2;
const SIGNAL_STRENGTH = 2.0;

export class GraphStrategyGame extends BaseGame {
  readonly name = 'Graph Strategy';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): GSState {
    const cfg = this.config as GraphStrategyConfig;
    const nodeCount = cfg.nodeCount ?? 12;
    const edgeDensity = cfg.edgeDensity ?? 0.3;
    const signalDecay = cfg.signalDecay ?? 0.1;
    const maxTurns = cfg.maxTurns ?? 50;

    // Generate nodes
    const nodes: GraphNode[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const signals: Record<string, number> = {};
      for (const pid of playerIds) {
        signals[pid] = 0;
      }

      nodes.push({
        id: i,
        signals,
        controller: null,
        fortified: false,
      });
    }

    // Give each player a starting node
    for (let p = 0; p < playerIds.length; p++) {
      const startNode = p === 0 ? 0 : nodeCount - 1;
      nodes[startNode].signals[playerIds[p]] = CONTROL_THRESHOLD + 1;
      nodes[startNode].controller = playerIds[p];
    }

    // Generate edges
    const edges = this.generateEdges(nodeCount, edgeDensity);

    return {
      nodes,
      edges,
      signalDecay,
      maxTurns,
      currentTurn: 1,
      turnOrder: [...playerIds],
      currentPlayerIndex: 0,
      actionsPerTurn: ACTIONS_PER_TURN,
      actionsThisTurn: 0,
      controlThreshold: CONTROL_THRESHOLD,
      gameResult: 'playing',
      nodeCount,
    };
  }

  private generateEdges(nodeCount: number, density: number): GraphEdge[] {
    const edges: GraphEdge[] = [];
    // Ensure connectivity: chain all nodes
    for (let i = 0; i < nodeCount - 1; i++) {
      edges.push({ from: i, to: i + 1 });
      edges.push({ from: i + 1, to: i });
    }

    // Add random edges based on density
    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        if (i === j) continue;
        if (edges.some((e) => e.from === i && e.to === j)) continue;
        if (Math.random() < density * 0.5) {
          edges.push({ from: i, to: j });
        }
      }
    }

    return edges;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<GSState>();

    if (data.gameResult !== 'playing') {
      return { success: false, error: 'Game is over' };
    }

    const currentPlayer = data.turnOrder[data.currentPlayerIndex];
    if (playerId !== currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    switch (action.type) {
      case 'place_signal':
        return this.handlePlaceSignal(playerId, action, data);
      case 'redirect_edge':
        return this.handleRedirectEdge(playerId, action, data);
      case 'fortify_node':
        return this.handleFortifyNode(playerId, action, data);
      case 'end_turn':
        return this.handleEndTurn(playerId, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handlePlaceSignal(playerId: string, action: GameAction, data: GSState): ActionResult {
    const nodeId = Number(action.payload.nodeId);

    if (isNaN(nodeId) || nodeId < 0 || nodeId >= data.nodes.length) {
      return { success: false, error: 'Invalid node' };
    }

    const node = data.nodes[nodeId];
    if (node.controller !== null && node.controller !== playerId) {
      return { success: false, error: 'Node is controlled by opponent' };
    }

    node.signals[playerId] = (node.signals[playerId] ?? 0) + SIGNAL_STRENGTH;
    this.updateNodeControl(node, data);
    data.actionsThisTurn++;

    this.emitEvent('signal_placed', playerId, { nodeId, strength: node.signals[playerId] });

    if (data.actionsThisTurn >= data.actionsPerTurn) {
      this.endTurn(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleRedirectEdge(playerId: string, action: GameAction, data: GSState): ActionResult {
    const fromNode = Number(action.payload.from);
    const toNode = Number(action.payload.to);
    const newTo = Number(action.payload.newTo);

    const edgeIndex = data.edges.findIndex((e) => e.from === fromNode && e.to === toNode);
    if (edgeIndex === -1) {
      return { success: false, error: 'Edge not found' };
    }

    if (isNaN(newTo) || newTo < 0 || newTo >= data.nodes.length) {
      return { success: false, error: 'Invalid target node' };
    }

    // Can only redirect edges from nodes you control
    const sourceNode = data.nodes[fromNode];
    if (sourceNode.controller !== playerId) {
      return { success: false, error: 'You do not control the source node' };
    }

    data.edges[edgeIndex].to = newTo;
    data.actionsThisTurn++;

    this.emitEvent('edge_redirected', playerId, { from: fromNode, oldTo: toNode, newTo });

    if (data.actionsThisTurn >= data.actionsPerTurn) {
      this.endTurn(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFortifyNode(playerId: string, action: GameAction, data: GSState): ActionResult {
    const nodeId = Number(action.payload.nodeId);

    if (isNaN(nodeId) || nodeId < 0 || nodeId >= data.nodes.length) {
      return { success: false, error: 'Invalid node' };
    }

    const node = data.nodes[nodeId];
    if (node.controller !== playerId) {
      return { success: false, error: 'You do not control this node' };
    }

    if (node.fortified) {
      return { success: false, error: 'Node already fortified' };
    }

    node.fortified = true;
    data.actionsThisTurn++;

    this.emitEvent('node_fortified', playerId, { nodeId });

    if (data.actionsThisTurn >= data.actionsPerTurn) {
      this.endTurn(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleEndTurn(playerId: string, data: GSState): ActionResult {
    this.endTurn(data);
    this.emitEvent('turn_ended', playerId, { turn: data.currentTurn });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private endTurn(data: GSState): void {
    // Propagate signals along edges
    this.propagateSignals(data);

    data.actionsThisTurn = 0;
    data.currentPlayerIndex = (data.currentPlayerIndex + 1) % data.turnOrder.length;

    // If wrapped around, increment turn
    if (data.currentPlayerIndex === 0) {
      data.currentTurn++;
    }

    // Check win conditions
    this.checkWinConditions(data);
  }

  private propagateSignals(data: GSState): void {
    // Calculate signal propagation
    const signalDeltas: Record<number, Record<string, number>> = {};

    for (const edge of data.edges) {
      const source = data.nodes[edge.from];
      if (!source) continue;

      if (!signalDeltas[edge.to]) {
        signalDeltas[edge.to] = {};
      }

      for (const [pid, strength] of Object.entries(source.signals)) {
        if (strength <= 0) continue;
        const propagated = strength * 0.3;
        signalDeltas[edge.to][pid] = (signalDeltas[edge.to][pid] ?? 0) + propagated;
      }
    }

    // Apply deltas and decay
    for (const node of data.nodes) {
      for (const pid of Object.keys(node.signals)) {
        // Apply propagation
        const delta = signalDeltas[node.id]?.[pid] ?? 0;
        node.signals[pid] = (node.signals[pid] ?? 0) + delta;

        // Apply decay (fortified nodes decay at half rate)
        const decayRate = node.fortified ? data.signalDecay * 0.5 : data.signalDecay;
        node.signals[pid] = Math.max(0, node.signals[pid] - decayRate);
      }

      this.updateNodeControl(node, data);
    }
  }

  private updateNodeControl(node: GraphNode, data: GSState): void {
    let maxSignal = 0;
    let maxPlayer: string | null = null;

    for (const [pid, strength] of Object.entries(node.signals)) {
      if (strength > maxSignal) {
        maxSignal = strength;
        maxPlayer = pid;
      }
    }

    if (maxSignal >= data.controlThreshold) {
      node.controller = maxPlayer;
    } else {
      node.controller = null;
    }
  }

  private checkWinConditions(data: GSState): void {
    // Instant win: control all nodes
    for (const pid of data.turnOrder) {
      const controlled = data.nodes.filter((n) => n.controller === pid).length;
      if (controlled === data.nodes.length) {
        data.gameResult = 'ended';
        return;
      }
    }

    // Time up
    if (data.currentTurn > data.maxTurns) {
      data.gameResult = 'ended';
    }
  }

  protected checkGameOver(): boolean {
    const data = this.getData<GSState>();
    return data.gameResult === 'ended';
  }

  protected determineWinner(): string | null {
    const data = this.getData<GSState>();
    let bestPlayer: string | null = null;
    let bestCount = -1;

    for (const pid of data.turnOrder) {
      const count = data.nodes.filter((n) => n.controller === pid).length;
      if (count > bestCount) {
        bestCount = count;
        bestPlayer = pid;
      }
    }

    // Check for tie
    const counts = data.turnOrder.map(
      (pid) => data.nodes.filter((n) => n.controller === pid).length,
    );
    if (counts.length >= 2 && counts[0] === counts[1]) {
      return null; // Draw
    }

    return bestPlayer;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<GSState>();
    const scores: Record<string, number> = {};
    for (const pid of data.turnOrder) {
      scores[pid] = data.nodes.filter((n) => n.controller === pid).length * 10;
    }
    return scores;
  }
}
