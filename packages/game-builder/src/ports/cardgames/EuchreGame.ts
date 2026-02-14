import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface EuchreConfig {
  targetScore?: number;
}

interface Card {
  rank: number; // 9, 10, 11=J, 12=Q, 13=K, 14=A
  suit: number; // 0=clubs, 1=diamonds, 2=hearts, 3=spades
}

interface EuchreState {
  [key: string]: unknown;
  deck: Card[];
  hands: Record<string, Card[]>;
  trump: number;
  turnedUp: Card | null;
  maker: string | null;
  goingAlone: boolean;
  loner: string | null;
  trickCards: Card[];
  trickPlayers: string[];
  leadSuit: number;
  currentPlayer: number;
  dealer: number;
  teamTricks: number[]; // [team0, team1]
  teamScores: number[]; // [team0, team1]
  phase: string; // 'calling_round1' | 'calling_round2' | 'playing' | 'done'
  callRound: number;
  callPosition: number;
  winner: string | null;
  targetScore: number;
}

function suitColor(suit: number): number {
  // 0=clubs(black), 1=diamonds(red), 2=hearts(red), 3=spades(black)
  return suit === 1 || suit === 2 ? 0 : 1;
}

function partnerSuit(suit: number): number {
  // Same color partner: clubs<>spades, diamonds<>hearts
  const partners: Record<number, number> = { 0: 3, 3: 0, 1: 2, 2: 1 };
  return partners[suit];
}

function euchreCardStrength(card: Card, trump: number, lead: number): number {
  const partner = partnerSuit(trump);
  // Right bower: Jack of trump
  if (card.rank === 11 && card.suit === trump) return 1000;
  // Left bower: Jack of partner suit
  if (card.rank === 11 && card.suit === partner) return 999;
  // Trump suit (excluding left bower which is already handled)
  if (card.suit === trump) return 500 + card.rank;
  // Lead suit
  if (card.suit === lead) return 200 + card.rank;
  // Off suit
  return card.rank;
}

function effectiveSuit(card: Card, trump: number): number {
  // Left bower counts as trump suit
  if (card.rank === 11 && card.suit === partnerSuit(trump)) return trump;
  return card.suit;
}

function createEuchreDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = 0; suit < 4; suit++) {
    for (const rank of [9, 10, 11, 12, 13, 14]) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Euchre: 4-player partnership trick-taking game with a 24-card deck.
 * Teams: players 0,2 vs players 1,3.
 * Trump is determined through a two-round calling process.
 * Going alone option for confident players.
 * 5 tricks per hand. Score based on tricks won vs. who called trump.
 * First team to target score (default 10) wins.
 * Actions: call_trump, pass, go_alone, play_card.
 */
export class EuchreGame extends BaseGame {
  readonly name = 'Euchre';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): EuchreState {
    const cfg = this.config as EuchreConfig;
    return this.dealNewHand(playerIds, 0, [0, 0], cfg.targetScore ?? 10);
  }

  private dealNewHand(
    playerIds: string[],
    dealer: number,
    teamScores: number[],
    targetScore: number,
  ): EuchreState {
    const deck = createEuchreDeck();
    const hands: Record<string, Card[]> = {};
    for (const pid of playerIds) {
      hands[pid] = [];
      for (let i = 0; i < 5; i++) hands[pid].push(deck.pop()!);
    }
    const turnedUp = deck.pop()!;
    return {
      deck,
      hands,
      trump: -1,
      turnedUp,
      maker: null,
      goingAlone: false,
      loner: null,
      trickCards: [],
      trickPlayers: [],
      leadSuit: -1,
      currentPlayer: (dealer + 1) % 4,
      dealer,
      teamTricks: [0, 0],
      teamScores,
      phase: 'calling_round1',
      callRound: 1,
      callPosition: 0,
      winner: null,
      targetScore,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<EuchreState>();
    const players = this.getPlayers();
    const pIdx = players.indexOf(playerId);

    if (data.phase === 'calling_round1') {
      if (pIdx !== data.currentPlayer) {
        return { success: false, error: 'Not your turn to call' };
      }

      if (action.type === 'call_trump') {
        // Round 1: accept the turned-up card's suit as trump
        data.trump = data.turnedUp!.suit;
        data.maker = playerId;
        // Dealer picks up turned-up card and discards
        const dealerPid = players[data.dealer];
        data.hands[dealerPid].push(data.turnedUp!);
        data.turnedUp = null;
        data.phase = 'playing';
        data.currentPlayer = (data.dealer + 1) % 4;

        this.emitEvent('trump_called', playerId, { trump: data.trump, round: 1 });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'go_alone') {
        data.trump = data.turnedUp!.suit;
        data.maker = playerId;
        data.goingAlone = true;
        data.loner = playerId;
        const dealerPid = players[data.dealer];
        data.hands[dealerPid].push(data.turnedUp!);
        data.turnedUp = null;
        data.phase = 'playing';
        data.currentPlayer = (data.dealer + 1) % 4;
        // Skip loner's partner
        this.skipPartner(data, players);

        this.emitEvent('going_alone', playerId, { trump: data.trump });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'pass') {
        data.callPosition++;
        if (data.callPosition >= 4) {
          data.phase = 'calling_round2';
          data.callPosition = 0;
          data.currentPlayer = (data.dealer + 1) % 4;
        } else {
          data.currentPlayer = (data.currentPlayer + 1) % 4;
        }
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    if (data.phase === 'calling_round2') {
      if (pIdx !== data.currentPlayer) {
        return { success: false, error: 'Not your turn to call' };
      }

      if (action.type === 'call_trump') {
        const suit = Number(action.payload.suit);
        if (isNaN(suit) || suit < 0 || suit > 3) {
          return { success: false, error: 'Must specify a valid suit (0-3)' };
        }
        if (suit === data.turnedUp!.suit) {
          return { success: false, error: 'Cannot call the same suit that was turned down' };
        }
        data.trump = suit;
        data.maker = playerId;
        data.phase = 'playing';
        data.currentPlayer = (data.dealer + 1) % 4;

        this.emitEvent('trump_called', playerId, { trump: data.trump, round: 2 });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'go_alone') {
        const suit = Number(action.payload.suit);
        if (isNaN(suit) || suit < 0 || suit > 3 || suit === data.turnedUp!.suit) {
          return { success: false, error: 'Invalid suit for go alone' };
        }
        data.trump = suit;
        data.maker = playerId;
        data.goingAlone = true;
        data.loner = playerId;
        data.phase = 'playing';
        data.currentPlayer = (data.dealer + 1) % 4;
        this.skipPartner(data, players);

        this.emitEvent('going_alone', playerId, { trump: data.trump });
        this.setData(data);
        return { success: true, newState: this.getState() };
      }

      if (action.type === 'pass') {
        data.callPosition++;
        if (data.callPosition >= 4) {
          // Stuck dealer rule: dealer must call
          // For simplicity, re-deal
          const newState = this.dealNewHand(
            players,
            (data.dealer + 1) % 4,
            data.teamScores,
            data.targetScore,
          );
          this.setData(newState);
          return { success: true, newState: this.getState() };
        }
        data.currentPlayer = (data.currentPlayer + 1) % 4;
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    if (data.phase === 'playing' && action.type === 'discard') {
      // Dealer discards after picking up
      if (pIdx !== data.dealer) {
        return { success: false, error: 'Only dealer discards' };
      }
      const cardIdx = Number(action.payload.cardIndex);
      const hand = data.hands[playerId];
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= hand.length) {
        return { success: false, error: 'Invalid card index' };
      }
      hand.splice(cardIdx, 1);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (data.phase === 'playing' && action.type === 'play_card') {
      if (pIdx !== data.currentPlayer) {
        return { success: false, error: 'Not your turn' };
      }

      const cardIdx = Number(action.payload.cardIndex);
      const hand = data.hands[playerId];
      if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= hand.length) {
        return { success: false, error: 'Invalid card index' };
      }

      const card = hand[cardIdx];

      // Must follow effective lead suit if possible
      if (data.trickCards.length > 0 && data.leadSuit >= 0) {
        const hasLead = hand.some((c) => effectiveSuit(c, data.trump) === data.leadSuit);
        if (hasLead && effectiveSuit(card, data.trump) !== data.leadSuit) {
          return { success: false, error: 'Must follow lead suit' };
        }
      }

      if (data.trickCards.length === 0) {
        data.leadSuit = effectiveSuit(card, data.trump);
      }

      hand.splice(cardIdx, 1);
      data.trickCards.push(card);
      data.trickPlayers.push(playerId);

      const playersInTrick = data.goingAlone ? 3 : 4;
      if (data.trickCards.length === playersInTrick) {
        // Resolve trick
        let bestIdx = 0;
        let bestStr = -1;
        for (let i = 0; i < data.trickCards.length; i++) {
          const s = euchreCardStrength(data.trickCards[i], data.trump, data.leadSuit);
          if (s > bestStr) {
            bestStr = s;
            bestIdx = i;
          }
        }
        const trickWinner = data.trickPlayers[bestIdx];
        const winnerIdx = players.indexOf(trickWinner);
        const team = winnerIdx % 2;
        data.teamTricks[team]++;

        this.emitEvent('trick_won', trickWinner, { team, tricks: data.teamTricks[team] });

        data.trickCards = [];
        data.trickPlayers = [];
        data.leadSuit = -1;
        data.currentPlayer = winnerIdx;

        const totalTricks = data.teamTricks[0] + data.teamTricks[1];
        if (totalTricks >= 5) {
          this.scoreHand(data, players);
        }
      } else {
        data.currentPlayer = (data.currentPlayer + 1) % 4;
        this.skipPartner(data, players);
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    return { success: false, error: `Invalid action '${action.type}' in phase '${data.phase}'` };
  }

  private skipPartner(data: EuchreState, players: string[]): void {
    if (!data.goingAlone || !data.loner) return;
    const lonerIdx = players.indexOf(data.loner);
    const partnerIdx = (lonerIdx + 2) % 4;
    if (data.currentPlayer === partnerIdx) {
      data.currentPlayer = (data.currentPlayer + 1) % 4;
    }
  }

  private scoreHand(data: EuchreState, players: string[]): void {
    const makerIdx = players.indexOf(data.maker!);
    const makerTeam = makerIdx % 2;
    const defenseTeam = 1 - makerTeam;

    if (data.teamTricks[makerTeam] >= 3) {
      if (data.teamTricks[makerTeam] === 5) {
        // March
        data.teamScores[makerTeam] += data.goingAlone ? 4 : 2;
      } else {
        data.teamScores[makerTeam] += 1;
      }
    } else {
      // Euchred
      data.teamScores[defenseTeam] += 2;
    }

    // Check for game winner
    if (data.teamScores[0] >= data.targetScore || data.teamScores[1] >= data.targetScore) {
      data.phase = 'done';
      const winningTeam = data.teamScores[0] >= data.targetScore ? 0 : 1;
      data.winner = players[winningTeam];
    } else {
      // Deal new hand
      const newState = this.dealNewHand(
        players,
        (data.dealer + 1) % 4,
        data.teamScores,
        data.targetScore,
      );
      // Preserve only the new hand state
      Object.assign(data, newState);
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<EuchreState>().phase === 'done';
  }

  protected determineWinner(): string | null {
    return this.getData<EuchreState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<EuchreState>();
    const players = this.getPlayers();
    const scores: Record<string, number> = {};
    for (let i = 0; i < players.length; i++) {
      scores[players[i]] = data.teamScores[i % 2];
    }
    return scores;
  }
}
