import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const SHAPES = ['circle', 'diamond', 'square', 'star', 'clover', 'cross'];

interface QTile {
  id: number;
  color: string;
  shape: string;
}

interface QwirkleState {
  [key: string]: unknown;
  board: Record<string, QTile>;
  hands: Record<string, QTile[]>;
  bag: QTile[];
  scores: Record<string, number>;
  currentPlayer: number;
  nextId: number;
}

export class QwirkleGame extends BaseGame {
  readonly name = 'Qwirkle';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private makeBag(): QTile[] {
    const bag: QTile[] = [];
    let id = 0;
    for (let i = 0; i < 3; i++) {
      for (const c of COLORS) for (const s of SHAPES) bag.push({ id: id++, color: c, shape: s });
    }
    return bag.sort(() => Math.random() - 0.5);
  }

  protected initializeState(playerIds: string[]): QwirkleState {
    const bag = this.makeBag();
    const hands: Record<string, QTile[]> = {};
    for (const p of playerIds) hands[p] = bag.splice(0, 6);
    return {
      board: {},
      hands,
      bag,
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      currentPlayer: 0,
      nextId: bag.length + playerIds.length * 6,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<QwirkleState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'play') return { success: false, error: 'Use play action' };

    const tiles = action.payload.tiles as Array<{ tileId: number; row: number; col: number }>;
    if (!tiles || tiles.length === 0) return { success: false, error: 'No tiles' };

    const hand = d.hands[playerId];
    let points = 0;

    for (const t of tiles) {
      const ti = hand.findIndex((h) => h.id === t.tileId);
      if (ti < 0) return { success: false, error: 'Tile not in hand' };
      const key = `${t.row},${t.col}`;
      if (d.board[key]) return { success: false, error: 'Cell occupied' };
      d.board[key] = hand[ti];
      hand.splice(ti, 1);
      points += 1;
    }

    // Bonus for 6 in a line (Qwirkle)
    if (tiles.length === 6) points += 6;

    d.scores[playerId] += points;

    // Refill hand
    while (hand.length < 6 && d.bag.length > 0) hand.push(d.bag.pop()!);
    d.currentPlayer = (d.currentPlayer + 1) % players.length;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<QwirkleState>();
    const players = this.getPlayers();
    return d.bag.length === 0 && players.some((p) => d.hands[p].length === 0);
  }

  protected determineWinner(): string | null {
    const d = this.getData<QwirkleState>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return best || null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<QwirkleState>().scores };
  }
}
