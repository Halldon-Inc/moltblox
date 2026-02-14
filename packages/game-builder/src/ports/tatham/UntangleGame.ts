/**
 * UntangleGame: Move points so no edges cross
 */

import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface UntangleConfig {
  nodeCount?: number;
}

interface Point {
  x: number;
  y: number;
}

interface Edge {
  from: number;
  to: number;
}

interface UntangleState {
  [key: string]: unknown;
  points: Point[];
  edges: Edge[];
  moves: number;
  solved: boolean;
}

export class UntangleGame extends BaseGame {
  readonly name = 'Untangle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  private segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false;

    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;

    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  }

  private countCrossings(points: Point[], edges: Edge[]): number {
    let crossings = 0;
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i];
        const e2 = edges[j];
        if (e1.from === e2.from || e1.from === e2.to || e1.to === e2.from || e1.to === e2.to)
          continue;

        if (
          this.segmentsIntersect(points[e1.from], points[e1.to], points[e2.from], points[e2.to])
        ) {
          crossings++;
        }
      }
    }
    return crossings;
  }

  protected initializeState(_playerIds: string[]): UntangleState {
    const cfg = this.config as UntangleConfig;
    const nodeCount = Math.max(4, Math.min(cfg.nodeCount ?? 10, 30));

    const points: Point[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount;
      points.push({
        x: Math.round((0.5 + 0.4 * Math.cos(angle)) * 1000) / 1000,
        y: Math.round((0.5 + 0.4 * Math.sin(angle)) * 1000) / 1000,
      });
    }

    const edges: Edge[] = [];
    for (let i = 0; i < nodeCount; i++) {
      edges.push({ from: i, to: (i + 1) % nodeCount });
    }

    const extraEdges = Math.floor(nodeCount * 0.3);
    for (let e = 0; e < extraEdges; e++) {
      const from = Math.floor(Math.random() * nodeCount);
      const to = Math.floor(Math.random() * nodeCount);
      if (from === to) continue;
      const exists = edges.some(
        (ed) => (ed.from === from && ed.to === to) || (ed.from === to && ed.to === from),
      );
      if (!exists) {
        edges.push({ from: Math.min(from, to), to: Math.max(from, to) });
      }
    }

    for (let i = 0; i < nodeCount; i++) {
      points[i] = {
        x: Math.round(Math.random() * 1000) / 1000,
        y: Math.round(Math.random() * 1000) / 1000,
      };
    }

    return {
      points,
      edges,
      moves: 0,
      solved: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UntangleState>();

    switch (action.type) {
      case 'move_point': {
        const index = Number(action.payload.index);
        const x = Number(action.payload.x);
        const y = Number(action.payload.y);

        if (index < 0 || index >= data.points.length) {
          return { success: false, error: 'Invalid point index' };
        }
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          return { success: false, error: 'Coordinates must be between 0 and 1' };
        }

        data.points[index] = { x, y };
        data.moves++;

        if (this.countCrossings(data.points, data.edges) === 0) {
          data.solved = true;
          this.emitEvent('puzzle_solved', playerId, { moves: data.moves });
        }

        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<UntangleState>().solved;
  }

  protected determineWinner(): string | null {
    return this.checkGameOver() ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<UntangleState>();
    const playerId = this.getPlayers()[0];
    if (!data.solved) return { [playerId]: 0 };
    const score = Math.max(0, 1000 - data.moves * 10);
    return { [playerId]: score };
  }
}
