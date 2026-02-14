import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface LiarsDiceState {
  [key: string]: unknown;
  dice: Record<string, number[]>;
  diceCount: Record<string, number>;
  currentPlayer: number;
  currentBid: { quantity: number; face: number } | null;
  winner: string | null;
  activePlayers: string[];
}

export class LiarsDiceGame extends BaseGame {
  readonly name = "Liar's Dice";
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  private rollDice(count: number): number[] {
    const dice: number[] = [];
    for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random() * 6) + 1);
    return dice;
  }

  protected initializeState(playerIds: string[]): LiarsDiceState {
    const dice: Record<string, number[]> = {};
    const diceCount: Record<string, number> = {};
    for (const p of playerIds) {
      dice[p] = this.rollDice(5);
      diceCount[p] = 5;
    }
    return {
      dice,
      diceCount,
      currentPlayer: 0,
      currentBid: null,
      winner: null,
      activePlayers: [...playerIds],
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<LiarsDiceState>();

    if (data.activePlayers[data.currentPlayer] !== playerId)
      return { success: false, error: 'Not your turn' };

    if (action.type === 'bid') {
      const quantity = Number(action.payload.quantity);
      const face = Number(action.payload.face);
      if (isNaN(quantity) || isNaN(face) || face < 1 || face > 6 || quantity < 1) {
        return { success: false, error: 'Invalid bid' };
      }

      if (data.currentBid) {
        const valid =
          quantity > data.currentBid.quantity ||
          (quantity === data.currentBid.quantity && face > data.currentBid.face);
        if (!valid) return { success: false, error: 'Bid must be higher' };
      }

      data.currentBid = { quantity, face };
      data.currentPlayer = (data.currentPlayer + 1) % data.activePlayers.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'challenge') {
      if (!data.currentBid) return { success: false, error: 'No bid to challenge' };

      // Count total dice matching the bid face (1s are wild)
      let totalMatch = 0;
      for (const p of data.activePlayers) {
        for (const d of data.dice[p]) {
          if (d === data.currentBid.face || d === 1) totalMatch++;
        }
      }

      const bidderIdx =
        (data.currentPlayer - 1 + data.activePlayers.length) % data.activePlayers.length;
      const bidder = data.activePlayers[bidderIdx];
      const challenger = playerId;

      let loser: string;
      if (totalMatch >= data.currentBid.quantity) {
        loser = challenger;
        this.emitEvent('challenge_failed', challenger, {
          actual: totalMatch,
          bid: data.currentBid,
        });
      } else {
        loser = bidder;
        this.emitEvent('challenge_success', challenger, {
          actual: totalMatch,
          bid: data.currentBid,
        });
      }

      data.diceCount[loser]--;
      if (data.diceCount[loser] <= 0) {
        data.activePlayers = data.activePlayers.filter((p) => p !== loser);
      }

      if (data.activePlayers.length <= 1) {
        data.winner = data.activePlayers[0] || null;
      } else {
        // Re-roll all dice
        for (const p of data.activePlayers) {
          data.dice[p] = this.rollDice(data.diceCount[p]);
        }
        data.currentBid = null;
        const loserIdx = data.activePlayers.indexOf(loser);
        data.currentPlayer = loserIdx >= 0 ? loserIdx : 0;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Unknown action: ${action.type}` };
  }

  protected checkGameOver(): boolean {
    return this.getData<LiarsDiceState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<LiarsDiceState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<LiarsDiceState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = data.diceCount[p];
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as LiarsDiceState;
    const masked: Record<string, number[]> = {};
    for (const [p, dice] of Object.entries(data.dice)) {
      masked[p] = p === playerId ? dice : dice.map(() => 0);
    }
    return { ...state, data: { ...data, dice: masked } };
  }
}
