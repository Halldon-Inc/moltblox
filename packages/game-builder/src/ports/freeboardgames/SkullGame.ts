import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface SkullPlayerState {
  coasters: ('flower' | 'skull')[]; // available coasters
  stack: ('flower' | 'skull')[]; // placed face-down
  alive: boolean;
  points: number;
}

interface SkullState {
  [key: string]: unknown;
  players: Record<string, SkullPlayerState>;
  currentPlayer: number;
  phase: string; // 'place' | 'bid' | 'reveal' | 'eliminate'
  currentBid: number;
  currentBidder: string | null;
  passedBidders: string[];
  revealCount: number;
  winner: string | null;
  gameEnded: boolean;
  roundStarter: number;
}

export class SkullGame extends BaseGame {
  readonly name = 'Skull';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): SkullState {
    const players: Record<string, SkullPlayerState> = {};
    for (const pid of playerIds) {
      players[pid] = {
        coasters: ['flower', 'flower', 'flower', 'skull'],
        stack: [],
        alive: true,
        points: 0,
      };
    }
    return {
      players,
      currentPlayer: 0,
      phase: 'place',
      currentBid: 0,
      currentBidder: null,
      passedBidders: [],
      revealCount: 0,
      winner: null,
      gameEnded: false,
      roundStarter: 0,
    };
  }

  private getAlivePlayers(): string[] {
    const data = this.getData<SkullState>();
    return this.getPlayers().filter((p) => data.players[p].alive);
  }

  private startNewRound(data: SkullState): void {
    const alive = this.getPlayers().filter((p) => data.players[p].alive);
    for (const pid of alive) {
      // Return stack cards to coasters
      data.players[pid].coasters.push(...data.players[pid].stack);
      data.players[pid].stack = [];
    }
    data.phase = 'place';
    data.currentBid = 0;
    data.currentBidder = null;
    data.passedBidders = [];
    data.revealCount = 0;
    data.currentPlayer = data.roundStarter % alive.length;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SkullState>();
    const alive = this.getAlivePlayers();

    if (alive.length <= 1) {
      data.gameEnded = true;
      data.winner = alive[0] || null;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const currentId = alive[data.currentPlayer % alive.length];

    if (data.phase === 'place') {
      if (playerId !== currentId) return { success: false, error: 'Not your turn' };

      if (action.type === 'place') {
        const coasterType = action.payload.coaster as string;
        const ps = data.players[playerId];
        const idx = ps.coasters.indexOf(coasterType as 'flower' | 'skull');
        if (idx === -1) return { success: false, error: 'Coaster not available' };
        ps.coasters.splice(idx, 1);
        ps.stack.push(coasterType as 'flower' | 'skull');
        data.currentPlayer = (data.currentPlayer + 1) % alive.length;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'bid') {
        // Must have placed at least one coaster
        if (data.players[playerId].stack.length === 0) {
          return { success: false, error: 'Must place at least one coaster before bidding' };
        }
        // All players must have placed at least one
        for (const pid of alive) {
          if (data.players[pid].stack.length === 0) {
            return { success: false, error: 'All players must place at least one coaster' };
          }
        }
        const bid = Number(action.payload.amount);
        const totalCoasters = alive.reduce((sum, p) => sum + data.players[p].stack.length, 0);
        if (bid < 1 || bid > totalCoasters) {
          return { success: false, error: 'Invalid bid amount' };
        }
        data.phase = 'bid';
        data.currentBid = bid;
        data.currentBidder = playerId;
        data.passedBidders = [];
        data.currentPlayer = (data.currentPlayer + 1) % alive.length;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      return { success: false, error: 'Must place or bid' };
    }

    if (data.phase === 'bid') {
      if (playerId !== currentId) return { success: false, error: 'Not your turn' };

      if (action.type === 'bid') {
        const bid = Number(action.payload.amount);
        if (bid <= data.currentBid) return { success: false, error: 'Bid must be higher' };
        const totalCoasters = alive.reduce((sum, p) => sum + data.players[p].stack.length, 0);
        if (bid > totalCoasters) return { success: false, error: 'Bid exceeds total coasters' };
        data.currentBid = bid;
        data.currentBidder = playerId;
        data.currentPlayer = (data.currentPlayer + 1) % alive.length;
        // Skip passed bidders
        while (data.passedBidders.includes(alive[data.currentPlayer % alive.length])) {
          data.currentPlayer = (data.currentPlayer + 1) % alive.length;
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'pass') {
        data.passedBidders.push(playerId);
        const activeBidders = alive.filter((p) => !data.passedBidders.includes(p));
        if (activeBidders.length <= 1) {
          // Bidding over, winner must reveal
          data.phase = 'reveal';
          data.revealCount = 0;
          data.currentPlayer = alive.indexOf(data.currentBidder!);
        } else {
          data.currentPlayer = (data.currentPlayer + 1) % alive.length;
          while (data.passedBidders.includes(alive[data.currentPlayer % alive.length])) {
            data.currentPlayer = (data.currentPlayer + 1) % alive.length;
          }
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      return { success: false, error: 'Must bid or pass' };
    }

    if (data.phase === 'reveal') {
      if (playerId !== data.currentBidder)
        return { success: false, error: 'Only bidder can reveal' };

      if (action.type !== 'reveal') return { success: false, error: 'Must reveal' };

      const targetPlayer = action.payload.target as string;
      if (!data.players[targetPlayer] || !data.players[targetPlayer].alive) {
        return { success: false, error: 'Invalid target' };
      }
      const targetStack = data.players[targetPlayer].stack;
      if (targetStack.length === 0) {
        return { success: false, error: 'No coasters to reveal' };
      }

      // Must reveal own stack first
      if (targetPlayer !== playerId && data.players[playerId].stack.length > 0) {
        return { success: false, error: 'Must reveal your own coasters first' };
      }

      const revealed = targetStack.pop()!;
      data.revealCount++;

      if (revealed === 'skull') {
        // Failed: lose a random coaster
        const ps = data.players[playerId];
        const allCoasters = [...ps.coasters, ...ps.stack];
        if (allCoasters.length > 0) {
          const removeIdx = Math.floor(Math.random() * allCoasters.length);
          allCoasters.splice(removeIdx, 1);
          ps.coasters = allCoasters;
          ps.stack = [];
        }
        if (ps.coasters.length === 0 && ps.stack.length === 0) {
          ps.alive = false;
        }
        data.roundStarter = alive.indexOf(playerId);
        this.startNewRound(data);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (data.revealCount >= data.currentBid) {
        // Success: earn a point
        data.players[playerId].points++;
        if (data.players[playerId].points >= 2) {
          data.gameEnded = true;
          data.winner = playerId;
        } else {
          data.roundStarter = alive.indexOf(playerId);
          this.startNewRound(data);
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: 'Invalid phase' };
  }

  protected checkGameOver(): boolean {
    return this.getData<SkullState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<SkullState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SkullState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.players[p].points * 50;
    }
    return scores;
  }
}
