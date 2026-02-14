import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface MahjongConfig {
  simplified?: boolean;
}

/**
 * Mahjong (simplified). 4 players. 136 tiles (3 suits x 9 ranks x 4 copies + honors).
 * Draw and discard. Form sets: Chi (sequential run of 3 in same suit),
 * Pong (3 of a kind), Kong (4 of a kind). Declare Hu (win) with
 * 4 sets + 1 pair (14 tiles). Simplified: no flowers, no winds scoring.
 *
 * Suits: bamboo (B), characters (C), dots (D), each 1-9.
 * Honors: winds (E,S,W,N) and dragons (Rd,Gd,Wd) = 7 honor tiles.
 */

interface MJTile {
  id: number;
  suit: string; // 'B','C','D','E','S','W','N','Rd','Gd','Wd'
  rank: number; // 1-9 for suits, 0 for honors
}

interface MahjongState {
  [key: string]: unknown;
  wall: MJTile[];
  hands: Record<string, MJTile[]>;
  melds: Record<string, MJTile[][]>; // revealed sets
  discardPile: MJTile[];
  lastDiscard: MJTile | null;
  lastDiscardPlayer: string | null;
  currentPlayer: number;
  phase: string; // 'draw' | 'discard' | 'claim'
  winner: string | null;
  drawnTile: MJTile | null;
}

let mjTileId = 0;

function createWall(): MJTile[] {
  mjTileId = 0;
  const tiles: MJTile[] = [];
  const suits = ['B', 'C', 'D'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: mjTileId++, suit, rank });
      }
    }
  }
  const honors = ['E', 'S', 'W', 'N', 'Rd', 'Gd', 'Wd'];
  for (const h of honors) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: mjTileId++, suit: h, rank: 0 });
    }
  }
  // Shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function canHu(hand: MJTile[]): boolean {
  // Check if hand forms winning pattern: 4 sets + 1 pair (14 tiles)
  if (hand.length < 14) return false;

  const sorted = [...hand].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.rank - b.rank;
  });

  // Group by suit+rank
  const counts: Record<string, number> = {};
  for (const t of sorted) {
    const key = `${t.suit}${t.rank}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  const keys = Object.keys(counts);

  // Try each possible pair
  for (const pairKey of keys) {
    if (counts[pairKey] < 2) continue;
    const remaining = { ...counts };
    remaining[pairKey] -= 2;
    if (canFormSets(remaining)) return true;
  }
  return false;
}

function canFormSets(counts: Record<string, number>): boolean {
  // Find first non-zero count
  let firstKey: string | null = null;
  for (const key of Object.keys(counts).sort()) {
    if (counts[key] > 0) {
      firstKey = key;
      break;
    }
  }
  if (firstKey === null) return true; // All consumed

  const suit = firstKey.slice(0, -1) || firstKey[0];
  const rank = Number(firstKey.slice(-1)) || Number(firstKey.slice(suit.length));

  // Try pong (3 of a kind)
  if (counts[firstKey] >= 3) {
    const next = { ...counts };
    next[firstKey] -= 3;
    if (canFormSets(next)) return true;
  }

  // Try chi (sequential, only for number suits B/C/D)
  if (['B', 'C', 'D'].includes(suit) && rank >= 1 && rank <= 7) {
    const k1 = `${suit}${rank}`;
    const k2 = `${suit}${rank + 1}`;
    const k3 = `${suit}${rank + 2}`;
    if ((counts[k1] || 0) >= 1 && (counts[k2] || 0) >= 1 && (counts[k3] || 0) >= 1) {
      const next = { ...counts };
      next[k1]--;
      next[k2]--;
      next[k3]--;
      if (canFormSets(next)) return true;
    }
  }

  return false;
}

export class MahjongGame extends BaseGame {
  readonly name = 'Mahjong';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  override initialize(playerIds: string[]): void {
    while (playerIds.length < 4) {
      playerIds.push(`bot-${playerIds.length}`);
    }
    super.initialize(playerIds);
  }

  protected initializeState(playerIds: string[]): MahjongState {
    const wall = createWall();
    const hands: Record<string, MJTile[]> = {};
    const melds: Record<string, MJTile[][]> = {};
    // Deal 13 tiles each
    for (const pid of playerIds) {
      hands[pid] = [];
      melds[pid] = [];
      for (let i = 0; i < 13; i++) {
        hands[pid].push(wall.pop()!);
      }
    }

    return {
      wall,
      hands,
      melds,
      discardPile: [],
      lastDiscard: null,
      lastDiscardPlayer: null,
      currentPlayer: 0,
      phase: 'draw',
      winner: null,
      drawnTile: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<MahjongState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    // During claim phase, any player (except discarder) can claim
    if (data.phase === 'claim') {
      if (playerId === data.lastDiscardPlayer) {
        return { success: false, error: 'Cannot claim your own discard' };
      }

      if (action.type === 'pass_claim') {
        // Check if all have passed (simplified: just advance)
        data.phase = 'draw';
        data.currentPlayer = (players.indexOf(data.lastDiscardPlayer!) + 1) % 4;
        data.lastDiscard = null;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'hu') {
        // Check if adding the discarded tile completes a winning hand
        const hand = [...data.hands[playerId], data.lastDiscard!];
        if (!canHu(hand)) {
          return { success: false, error: 'Not a winning hand' };
        }
        data.hands[playerId].push(data.lastDiscard!);
        data.winner = playerId;
        this.emitEvent('hu', playerId, {});
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'pong') {
        const tile = data.lastDiscard!;
        const hand = data.hands[playerId];
        const matching = hand.filter((t) => t.suit === tile.suit && t.rank === tile.rank);
        if (matching.length < 2) {
          return { success: false, error: 'Need 2 matching tiles for pong' };
        }
        // Remove 2 from hand, add meld
        let removed = 0;
        data.hands[playerId] = hand.filter((t) => {
          if (removed < 2 && t.suit === tile.suit && t.rank === tile.rank) {
            removed++;
            return false;
          }
          return true;
        });
        data.melds[playerId].push([tile, matching[0], matching[1]]);
        data.lastDiscard = null;
        data.phase = 'discard';
        data.currentPlayer = players.indexOf(playerId);
        this.emitEvent('pong', playerId, { suit: tile.suit, rank: tile.rank });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'chi') {
        // Only next player in turn order can chi
        const nextPlayer = (players.indexOf(data.lastDiscardPlayer!) + 1) % 4;
        if (players.indexOf(playerId) !== nextPlayer) {
          return { success: false, error: 'Only the next player can chi' };
        }
        const tile = data.lastDiscard!;
        if (!['B', 'C', 'D'].includes(tile.suit)) {
          return { success: false, error: 'Cannot chi honor tiles' };
        }
        const cards = action.payload.cards as number[];
        if (!Array.isArray(cards) || cards.length !== 2) {
          return { success: false, error: 'Chi requires exactly 2 card indices from your hand' };
        }
        const hand = data.hands[playerId];
        const c1 = hand[cards[0]];
        const c2 = hand[cards[1]];
        if (!c1 || !c2) return { success: false, error: 'Invalid card indices' };
        // Check they form a sequence with the discarded tile
        const threeRanks = [tile.rank, c1.rank, c2.rank].sort((a, b) => a - b);
        if (c1.suit !== tile.suit || c2.suit !== tile.suit) {
          return { success: false, error: 'Chi tiles must be same suit' };
        }
        if (threeRanks[2] - threeRanks[0] !== 2 || threeRanks[1] - threeRanks[0] !== 1) {
          return { success: false, error: 'Chi tiles must form a sequence' };
        }
        // Remove from hand
        const sorted = [...cards].sort((a, b) => b - a);
        for (const idx of sorted) hand.splice(idx, 1);
        data.melds[playerId].push([tile, c1, c2]);
        data.lastDiscard = null;
        data.phase = 'discard';
        data.currentPlayer = players.indexOf(playerId);
        this.emitEvent('chi', playerId, { suit: tile.suit });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      return { success: false, error: `Unknown claim action: ${action.type}` };
    }

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (data.phase === 'draw') {
      if (action.type !== 'draw') {
        return { success: false, error: 'Must draw a tile (action: draw)' };
      }
      if (data.wall.length === 0) {
        // Draw: game ends in draw
        data.winner = null;
        data.phase = 'ended';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      const tile = data.wall.pop()!;
      data.hands[playerId].push(tile);
      data.drawnTile = tile;

      // Check self-draw win (tsumo)
      if (canHu(data.hands[playerId])) {
        if (action.payload.autoHu === true) {
          data.winner = playerId;
          this.emitEvent('tsumo', playerId, {});
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      }

      data.phase = 'discard';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'discard') {
      if (action.type === 'hu') {
        // Self-draw win
        if (!canHu(data.hands[playerId])) {
          return { success: false, error: 'Not a winning hand' };
        }
        data.winner = playerId;
        this.emitEvent('tsumo', playerId, {});
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type !== 'discard') {
        return { success: false, error: 'Must discard a tile (action: discard)' };
      }
      const tileIdx = Number(action.payload.tileIndex);
      const hand = data.hands[playerId];
      if (isNaN(tileIdx) || tileIdx < 0 || tileIdx >= hand.length) {
        return { success: false, error: 'Invalid tile index' };
      }
      const discarded = hand.splice(tileIdx, 1)[0];
      data.discardPile.push(discarded);
      data.lastDiscard = discarded;
      data.lastDiscardPlayer = playerId;
      data.drawnTile = null;

      // Enter claim phase
      data.phase = 'claim';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Invalid phase: ${data.phase}` };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as MahjongState;
    const players = this.getPlayers();
    for (const pid of players) {
      if (pid !== playerId) {
        data.hands[pid] = Array(data.hands[pid].length).fill({ id: -1, suit: '?', rank: 0 });
      }
    }
    return state;
  }

  protected checkGameOver(): boolean {
    const data = this.getData<MahjongState>();
    return data.winner !== null || data.phase === 'ended';
  }

  protected determineWinner(): string | null {
    return this.getData<MahjongState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<MahjongState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = p === data.winner ? 10 : 0;
    }
    return scores;
  }
}
