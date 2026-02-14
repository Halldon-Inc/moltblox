import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface SproutsState {
  [key: string]: unknown;
  nodes: Record<number, number>; // nodeId -> edge count
  edges: number[][];
  nextNode: number;
  currentPlayer: number;
  winner: string | null;
  maxEdges: number; // each node max 3
}

export class SproutsGame extends BaseGame {
  readonly name = 'Sprouts';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): SproutsState {
    const startNodes = (this.config.startNodes as number) ?? 3;
    const nodes: Record<number, number> = {};
    for (let i = 0; i < startNodes; i++) nodes[i] = 0;
    return {
      nodes,
      edges: [],
      nextNode: startNodes,
      currentPlayer: 0,
      winner: null,
      maxEdges: 3,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<SproutsState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'connect') return { success: false, error: 'Use connect action' };

    const n1 = Number(action.payload.node1),
      n2 = Number(action.payload.node2);
    if (!(n1 in d.nodes) || !(n2 in d.nodes)) return { success: false, error: 'Invalid node' };
    if (d.nodes[n1] >= d.maxEdges || d.nodes[n2] >= d.maxEdges)
      return { success: false, error: 'Node is full' };

    d.edges.push([n1, n2]);
    d.nodes[n1]++;
    d.nodes[n2]++;
    if (n1 === n2) d.nodes[n1]++; // Self-loop costs 2

    // New node on the edge
    const newId = d.nextNode++;
    d.nodes[newId] = 2; // Born with 2 edges (connected to both endpoints)

    // Check if any moves possible
    const alive = Object.entries(d.nodes).filter(([_, count]) => count < d.maxEdges);
    if (alive.length < 2) {
      // No more moves, current player loses (last to move wins)
      d.winner = playerId;
    }

    d.currentPlayer = (d.currentPlayer + 1) % 2;
    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<SproutsState>().winner !== null;
  }
  protected determineWinner(): string | null {
    return this.getData<SproutsState>().winner;
  }
  protected calculateScores(): Record<string, number> {
    const w = this.determineWinner();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = p === w ? 1 : 0;
    return scores;
  }
}
