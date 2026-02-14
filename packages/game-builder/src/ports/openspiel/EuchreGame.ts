import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Card {
  suit: number;
  rank: number;
}

interface EuchreState {
  [key: string]: unknown;
  hands: Record<string, Card[]>;
  deck: Card[];
  turnUpCard: Card | null;
  trump: number;
  dealer: number;
  currentPlayer: number;
  phase: string;
  currentTrick: { player: string; card: Card }[];
  tricksWon: [number, number];
  teamScores: [number, number];
  maker: number;
  goingAlone: boolean;
  alonePlayer: string | null;
  winner: string | null;
  targetScore: number;
}

export class EuchreGame extends BaseGame {
  readonly name = 'Euchre';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 9; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): EuchreState {
    const deck = this.createDeck();
    const hands: Record<string, Card[]> = {};
    for (const p of playerIds) hands[p] = deck.splice(0, 5);
    const turnUpCard = deck.pop()!;

    return {
      hands,
      deck,
      turnUpCard,
      trump: -1,
      dealer: 0,
      currentPlayer: 1,
      phase: 'bidding_round1',
      currentTrick: [],
      tricksWon: [0, 0],
      teamScores: [0, 0],
      maker: -1,
      goingAlone: false,
      alonePlayer: null,
      winner: null,
      targetScore: 10,
    };
  }

  private getTeam(playerIndex: number): number {
    return playerIndex % 2;
  }

  private getPartnerSuit(suit: number): number {
    if (suit === 0) return 1;
    if (suit === 1) return 0;
    if (suit === 2) return 3;
    return 2;
  }

  private cardStrength(card: Card, trump: number, leadSuit: number): number {
    const partnerSuit = this.getPartnerSuit(trump);
    if (card.rank === 11 && card.suit === trump) return 100;
    if (card.rank === 11 && card.suit === partnerSuit) return 99;
    if (card.suit === trump) return 50 + card.rank;
    if (card.suit === leadSuit) return card.rank;
    return 0;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<EuchreState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (data.phase === 'bidding_round1') {
      if (action.type === 'order_up') {
        data.trump = data.turnUpCard!.suit;
        data.maker = this.getTeam(data.currentPlayer);
        data.goingAlone = action.payload.alone === true;
        if (data.goingAlone) data.alonePlayer = playerId;
        const dealerId = players[data.dealer];
        data.hands[dealerId].push(data.turnUpCard!);
        data.turnUpCard = null;
        data.phase = 'dealer_discard';
        data.currentPlayer = data.dealer;
      } else if (action.type === 'pass') {
        data.currentPlayer = (data.currentPlayer + 1) % 4;
        if (data.currentPlayer === data.dealer) {
          data.currentPlayer = (data.dealer + 1) % 4;
          data.phase = 'bidding_round2';
        }
      } else {
        return { success: false, error: `Invalid action during bidding: ${action.type}` };
      }
    } else if (data.phase === 'bidding_round2') {
      if (action.type === 'call_trump') {
        const suit = Number(action.payload.suit);
        if (suit < 0 || suit > 3 || suit === data.turnUpCard?.suit) {
          return { success: false, error: 'Invalid trump suit' };
        }
        data.trump = suit;
        data.maker = this.getTeam(data.currentPlayer);
        data.goingAlone = action.payload.alone === true;
        if (data.goingAlone) data.alonePlayer = playerId;
        data.phase = 'playing';
        data.currentPlayer = (data.dealer + 1) % 4;
      } else if (action.type === 'pass') {
        data.currentPlayer = (data.currentPlayer + 1) % 4;
        if (data.currentPlayer === (data.dealer + 1) % 4) {
          data.currentPlayer = data.dealer;
        }
      } else {
        return { success: false, error: `Invalid action during bidding: ${action.type}` };
      }
    } else if (data.phase === 'dealer_discard') {
      if (action.type !== 'discard') return { success: false, error: 'Dealer must discard a card' };
      const cardIdx = Number(action.payload.cardIndex);
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
        return { success: false, error: 'Invalid card index' };
      }
      data.hands[playerId].splice(cardIdx, 1);
      data.phase = 'playing';
      data.currentPlayer = (data.dealer + 1) % 4;
    } else if (data.phase === 'playing') {
      if (action.type !== 'play')
        return { success: false, error: `Unknown action: ${action.type}` };

      if (data.goingAlone && data.alonePlayer) {
        const aloneIdx = players.indexOf(data.alonePlayer);
        const partnerIdx = (aloneIdx + 2) % 4;
        if (data.currentPlayer === partnerIdx) {
          data.currentPlayer = (data.currentPlayer + 1) % 4;
          this.setData(data);
          return { success: true, newState: this.getState() };
        }
      }

      const cardIdx = Number(action.payload.cardIndex);
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
        return { success: false, error: 'Invalid card index' };
      }

      const card = data.hands[playerId][cardIdx];

      if (data.currentTrick.length > 0) {
        const leadSuit = data.currentTrick[0].card.suit;
        const hasLead = data.hands[playerId].some((c) => c.suit === leadSuit);
        if (hasLead && card.suit !== leadSuit) {
          const partnerSuit = this.getPartnerSuit(data.trump);
          const isLeftBower = card.rank === 11 && card.suit === partnerSuit;
          if (!isLeftBower || leadSuit !== data.trump) {
            return { success: false, error: 'Must follow suit' };
          }
        }
      }

      data.hands[playerId].splice(cardIdx, 1);
      data.currentTrick.push({ player: playerId, card });

      const trickSize = data.goingAlone ? 3 : 4;

      if (data.currentTrick.length >= trickSize) {
        const leadSuit = data.currentTrick[0].card.suit;
        let bestEntry = data.currentTrick[0];
        let bestStrength = this.cardStrength(bestEntry.card, data.trump, leadSuit);

        for (let i = 1; i < data.currentTrick.length; i++) {
          const str = this.cardStrength(data.currentTrick[i].card, data.trump, leadSuit);
          if (str > bestStrength) {
            bestStrength = str;
            bestEntry = data.currentTrick[i];
          }
        }

        const winTeam = this.getTeam(players.indexOf(bestEntry.player));
        data.tricksWon[winTeam]++;
        data.currentTrick = [];

        if (data.tricksWon[0] + data.tricksWon[1] >= 5) {
          this.scoreHand(data);
          if (data.teamScores[0] >= data.targetScore || data.teamScores[1] >= data.targetScore) {
            const winTeamIdx = data.teamScores[0] >= data.targetScore ? 0 : 1;
            data.winner = players[winTeamIdx];
          } else {
            this.dealNewHand(data, players);
          }
        } else {
          data.currentPlayer = players.indexOf(bestEntry.player);
        }
      } else {
        data.currentPlayer = (data.currentPlayer + 1) % 4;
        if (data.goingAlone && data.alonePlayer) {
          const aloneIdx = players.indexOf(data.alonePlayer);
          const partnerIdx = (aloneIdx + 2) % 4;
          if (data.currentPlayer === partnerIdx) {
            data.currentPlayer = (data.currentPlayer + 1) % 4;
          }
        }
      }
    } else {
      return { success: false, error: `Invalid game phase: ${data.phase}` };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private scoreHand(data: EuchreState): void {
    const makerTeam = data.maker;
    const defenseTeam = 1 - makerTeam;
    const makerTricks = data.tricksWon[makerTeam];

    if (makerTricks >= 5) {
      data.teamScores[makerTeam] += data.goingAlone ? 4 : 2;
    } else if (makerTricks >= 3) {
      data.teamScores[makerTeam] += 1;
    } else {
      data.teamScores[defenseTeam] += 2;
    }
  }

  private dealNewHand(data: EuchreState, players: string[]): void {
    const deck = this.createDeck();
    for (const p of players) data.hands[p] = deck.splice(0, 5);
    data.turnUpCard = deck.pop()!;
    data.deck = deck;
    data.dealer = (data.dealer + 1) % 4;
    data.currentPlayer = (data.dealer + 1) % 4;
    data.phase = 'bidding_round1';
    data.currentTrick = [];
    data.tricksWon = [0, 0];
    data.maker = -1;
    data.goingAlone = false;
    data.alonePlayer = null;
  }

  protected checkGameOver(): boolean {
    return this.getData<EuchreState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<EuchreState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<EuchreState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    for (let i = 0; i < players.length; i++) scores[players[i]] = data.teamScores[this.getTeam(i)];
    return scores;
  }

  getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const d = state.data as EuchreState;
    const maskedHands: Record<string, Card[]> = {};
    for (const [p, cards] of Object.entries(d.hands)) {
      maskedHands[p] = p === playerId ? cards : cards.map(() => ({ suit: -1, rank: -1 }));
    }
    return { ...state, data: { ...d, hands: maskedHands } };
  }
}
