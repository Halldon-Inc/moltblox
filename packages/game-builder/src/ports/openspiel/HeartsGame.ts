import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface HeartsState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  currentTrick: { player: string; card: Card }[];
  leadSuit: number | null;
  trickWins: Record<string, Card[]>;
  scores: Record<string, number>;
  roundScores: Record<string, number>;
  currentPlayer: number;
  heartsBroken: boolean;
  winner: string | null;
  passingPhase: boolean;
  passCards: Record<string, Card[]>;
  passDirection: number;
}

export class HeartsGame extends BaseGame {
  readonly name = 'Hearts';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): HeartsState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    const trickWins: Record<string, Card[]> = {};
    const scores: Record<string, number> = {};
    const roundScores: Record<string, number> = {};
    const passCards: Record<string, Card[]> = {};

    for (let i = 0; i < 4; i++) {
      hands[playerIds[i]] = deck.slice(i * 13, (i + 1) * 13);
      trickWins[playerIds[i]] = [];
      scores[playerIds[i]] = 0;
      roundScores[playerIds[i]] = 0;
      passCards[playerIds[i]] = [];
    }

    // Find who has 2 of clubs (suit 2 = clubs, rank 2)
    let startPlayer = 0;
    for (let i = 0; i < 4; i++) {
      if (hands[playerIds[i]].some((c) => c.suit === 2 && c.rank === 2)) {
        startPlayer = i;
        break;
      }
    }

    return {
      hands,
      currentTrick: [],
      leadSuit: null,
      trickWins,
      scores,
      roundScores,
      currentPlayer: startPlayer,
      heartsBroken: false,
      winner: null,
      passingPhase: true,
      passCards,
      passDirection: 1,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<HeartsState>();
    const players = this.getPlayers();

    if (data.passingPhase) {
      if (action.type !== 'pass_cards') return { success: false, error: 'Must pass 3 cards' };
      const indices = (action.payload.cardIndices as number[]) || [];
      if (indices.length !== 3) return { success: false, error: 'Must pass exactly 3 cards' };

      const cards: Card[] = [];
      for (const idx of indices.sort((a, b) => b - a)) {
        if (idx < 0 || idx >= data.hands[playerId].length)
          return { success: false, error: 'Invalid card index' };
        cards.push(data.hands[playerId].splice(idx, 1)[0]);
      }
      data.passCards[playerId] = cards;

      // Check if all players have passed
      if (players.every((p) => data.passCards[p].length === 3)) {
        for (let i = 0; i < 4; i++) {
          const targetIdx = (i + data.passDirection) % 4;
          data.hands[players[targetIdx]].push(...data.passCards[players[i]]);
        }
        data.passingPhase = false;
        for (const p of players) data.passCards[p] = [];
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'play') return { success: false, error: `Unknown action: ${action.type}` };

    const cardIdx = Number(action.payload.cardIndex);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = data.hands[playerId][cardIdx];

    // First trick: must lead 2 of clubs
    if (
      data.currentTrick.length === 0 &&
      !data.heartsBroken &&
      Object.values(data.trickWins).every((w) => w.length === 0)
    ) {
      if (data.hands[playerId].some((c) => c.suit === 2 && c.rank === 2)) {
        if (card.suit !== 2 || card.rank !== 2)
          return { success: false, error: 'Must lead with 2 of clubs' };
      }
    }

    // Must follow suit
    if (data.currentTrick.length > 0) {
      const leadSuit = data.currentTrick[0].card.suit;
      if (card.suit !== leadSuit && data.hands[playerId].some((c) => c.suit === leadSuit)) {
        return { success: false, error: 'Must follow suit' };
      }
    }

    // Cannot lead hearts unless broken
    if (data.currentTrick.length === 0 && card.suit === 0 && !data.heartsBroken) {
      if (data.hands[playerId].some((c) => c.suit !== 0)) {
        return { success: false, error: 'Hearts not broken yet' };
      }
    }

    data.hands[playerId].splice(cardIdx, 1);
    data.currentTrick.push({ player: playerId, card });

    // Hearts broken check
    if (card.suit === 0) data.heartsBroken = true;

    // Trick complete
    if (data.currentTrick.length === 4) {
      const leadSuit = data.currentTrick[0].card.suit;
      let winnerEntry = data.currentTrick[0];
      for (let i = 1; i < 4; i++) {
        if (
          data.currentTrick[i].card.suit === leadSuit &&
          data.currentTrick[i].card.rank > winnerEntry.card.rank
        ) {
          winnerEntry = data.currentTrick[i];
        }
      }

      for (const entry of data.currentTrick) {
        data.trickWins[winnerEntry.player].push(entry.card);
        if (entry.card.suit === 0) data.roundScores[winnerEntry.player]++;
        if (entry.card.suit === 3 && entry.card.rank === 12)
          data.roundScores[winnerEntry.player] += 13; // Queen of spades
      }

      data.currentPlayer = players.indexOf(winnerEntry.player);
      data.currentTrick = [];
      data.leadSuit = null;

      // Round over
      if (players.every((p) => data.hands[p].length === 0)) {
        // Shoot the moon check
        const moonShooter = players.find((p) => data.roundScores[p] === 26);
        if (moonShooter) {
          for (const p of players) {
            if (p !== moonShooter) data.scores[p] += 26;
          }
        } else {
          for (const p of players) data.scores[p] += data.roundScores[p];
        }

        // Check game over (100 points)
        if (players.some((p) => data.scores[p] >= 100)) {
          let best: string | null = null;
          let bestScore = Infinity;
          for (const p of players) {
            if (data.scores[p] < bestScore) {
              bestScore = data.scores[p];
              best = p;
            }
          }
          data.winner = best;
        } else {
          // New round
          const deck = this.createDeck();
          for (let i = 0; i < 4; i++) {
            data.hands[players[i]] = deck.slice(i * 13, (i + 1) * 13);
            data.trickWins[players[i]] = [];
            data.roundScores[players[i]] = 0;
          }
          data.heartsBroken = false;
          data.passDirection = (data.passDirection % 3) + 1;
          if (data.passDirection <= 3) {
            data.passingPhase = true;
          }
          for (let i = 0; i < 4; i++) {
            if (data.hands[players[i]].some((c) => c.suit === 2 && c.rank === 2)) {
              data.currentPlayer = i;
              break;
            }
          }
        }
      }
    } else {
      data.currentPlayer = (data.currentPlayer + 1) % 4;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<HeartsState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<HeartsState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<HeartsState>();
    // In Hearts, lower score is better, so invert for ranking
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = -data.scores[p];
    return scores;
  }
}
