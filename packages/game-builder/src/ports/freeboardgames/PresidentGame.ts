import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

// Card ranks: 3,4,5,6,7,8,9,10,J(11),Q(12),K(13),A(14),2(15) (2 is highest)
interface PresidentState {
  [key: string]: unknown;
  hands: Record<string, number[]>;
  currentPlayer: number;
  lastPlay: number[];
  lastPlayedBy: string | null;
  passCount: number;
  finishOrder: string[];
  rankings: Record<string, string>; // president, vice-president, etc.
  winner: string | null;
  gameEnded: boolean;
  roundActive: boolean;
}

function createDeck(): number[] {
  const deck: number[] = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (let suit = 0; suit < 4; suit++) {
      deck.push(rank);
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class PresidentGame extends BaseGame {
  readonly name = 'President';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): PresidentState {
    const deck = createDeck();
    const hands: Record<string, number[]> = {};
    let idx = 0;
    for (const pid of playerIds) hands[pid] = [];
    while (idx < deck.length) {
      for (const pid of playerIds) {
        if (idx < deck.length) {
          hands[pid].push(deck[idx++]);
        }
      }
    }
    // Sort each hand
    for (const pid of playerIds) hands[pid].sort((a, b) => a - b);

    return {
      hands,
      currentPlayer: 0,
      lastPlay: [],
      lastPlayedBy: null,
      passCount: 0,
      finishOrder: [],
      rankings: {},
      winner: null,
      gameEnded: false,
      roundActive: true,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<PresidentState>();
    const activePlayers = this.getPlayers().filter(
      (p) => data.hands[p].length > 0 && !data.finishOrder.includes(p),
    );

    if (activePlayers.length === 0) {
      this.finishGame(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    const currentId = activePlayers[data.currentPlayer % activePlayers.length];
    if (playerId !== currentId) return { success: false, error: 'Not your turn' };

    if (action.type === 'pass') {
      data.passCount++;
      // If all remaining players pass, clear the pile
      if (data.passCount >= activePlayers.length - 1) {
        data.lastPlay = [];
        data.lastPlayedBy = null;
        data.passCount = 0;
      }
      data.currentPlayer = (data.currentPlayer + 1) % activePlayers.length;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') return { success: false, error: 'Must play or pass' };

    const cards = action.payload.cards as number[];
    if (!Array.isArray(cards) || cards.length === 0) {
      return { success: false, error: 'Must play at least one card' };
    }

    // All cards must be the same rank
    const rank = cards[0];
    if (!cards.every((c) => c === rank)) {
      return { success: false, error: 'All cards must be the same rank' };
    }

    // Player must have these cards
    const hand = [...data.hands[playerId]];
    for (const card of cards) {
      const idx = hand.indexOf(card);
      if (idx === -1) return { success: false, error: 'Card not in hand' };
      hand.splice(idx, 1);
    }

    // Must match count of last play (or be first play)
    if (data.lastPlay.length > 0) {
      if (cards.length !== data.lastPlay.length) {
        return { success: false, error: 'Must play same number of cards' };
      }
      if (rank <= data.lastPlay[0]) {
        return { success: false, error: 'Must play higher rank' };
      }
    }

    // Play the cards
    data.hands[playerId] = hand;
    data.lastPlay = cards;
    data.lastPlayedBy = playerId;
    data.passCount = 0;

    // Check if player finished
    if (hand.length === 0) {
      data.finishOrder.push(playerId);
      data.lastPlay = [];
      data.lastPlayedBy = null;
      data.passCount = 0;
    }

    // Refresh active players
    const newActive = this.getPlayers().filter(
      (p) => data.hands[p].length > 0 && !data.finishOrder.includes(p),
    );

    if (newActive.length <= 1) {
      // Last player auto-finishes
      for (const p of newActive) {
        if (!data.finishOrder.includes(p)) data.finishOrder.push(p);
      }
      this.finishGame(data);
    } else {
      data.currentPlayer = (data.currentPlayer + 1) % newActive.length;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private finishGame(data: PresidentState): void {
    // Add any remaining players
    for (const p of this.getPlayers()) {
      if (!data.finishOrder.includes(p)) data.finishOrder.push(p);
    }

    const rankNames = ['President', 'Vice President', 'Citizen', 'Citizen', 'Vice Scum', 'Scum'];
    for (let i = 0; i < data.finishOrder.length; i++) {
      data.rankings[data.finishOrder[i]] = rankNames[i] || 'Citizen';
    }

    data.gameEnded = true;
    data.winner = data.finishOrder[0] || null;
  }

  protected checkGameOver(): boolean {
    return this.getData<PresidentState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<PresidentState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<PresidentState>();
    const scores: Record<string, number> = {};
    for (let i = 0; i < data.finishOrder.length; i++) {
      scores[data.finishOrder[i]] = (data.finishOrder.length - i) * 10;
    }
    // Fill in any missing
    for (const p of this.getPlayers()) {
      if (scores[p] === undefined) scores[p] = 0;
    }
    return scores;
  }
}
