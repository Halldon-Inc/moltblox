import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface UnoCard {
  color: string;
  value: string;
}

interface UnoState {
  [key: string]: unknown;
  deck: UnoCard[];
  hands: Record<string, UnoCard[]>;
  discardPile: UnoCard[];
  currentPlayer: number;
  direction: number;
  currentColor: string;
  drawPending: number;
  winner: string | null;
  mustDraw: boolean;
}

export class UnoGame extends BaseGame {
  readonly name = 'UNO';
  readonly version = '1.0.0';
  readonly maxPlayers = 8;

  private createDeck(): UnoCard[] {
    const colors = ['red', 'blue', 'green', 'yellow'];
    const deck: UnoCard[] = [];

    for (const color of colors) {
      deck.push({ color, value: '0' });
      for (let v = 1; v <= 9; v++) {
        deck.push({ color, value: String(v) });
        deck.push({ color, value: String(v) });
      }
      for (const special of ['skip', 'reverse', 'draw2']) {
        deck.push({ color, value: special });
        deck.push({ color, value: special });
      }
    }
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'wild' });
      deck.push({ color: 'wild', value: 'wild_draw4' });
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  protected initializeState(playerIds: string[]): UnoState {
    const deck = this.createDeck();
    const hands: Record<string, UnoCard[]> = {};
    for (const p of playerIds) {
      hands[p] = [];
      for (let i = 0; i < 7; i++) hands[p].push(deck.pop()!);
    }

    // First card must be a number card
    let firstCard = deck.pop()!;
    while (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2'].includes(firstCard.value)) {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }

    return {
      deck,
      hands,
      discardPile: [firstCard],
      currentPlayer: 0,
      direction: 1,
      currentColor: firstCard.color,
      drawPending: 0,
      winner: null,
      mustDraw: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UnoState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'draw') {
      const drawCount = Math.max(1, data.drawPending);
      for (let i = 0; i < drawCount; i++) {
        this.ensureDeck(data);
        if (data.deck.length > 0) data.hands[playerId].push(data.deck.pop()!);
      }
      data.drawPending = 0;
      data.mustDraw = false;
      this.advancePlayer(data, players);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') return { success: false, error: `Unknown action: ${action.type}` };

    if (data.mustDraw) return { success: false, error: 'Must draw cards first' };

    const cardIdx = Number(action.payload.cardIndex);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= data.hands[playerId].length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = data.hands[playerId][cardIdx];
    const topCard = data.discardPile[data.discardPile.length - 1];

    // Validate play
    if (card.color === 'wild') {
      // Wild cards can always be played
    } else if (card.color !== data.currentColor && card.value !== topCard.value) {
      return { success: false, error: 'Card must match color or value' };
    }

    // Handle draw2/wild_draw4 stacking
    if (data.drawPending > 0) {
      if (card.value !== 'draw2' && card.value !== 'wild_draw4') {
        return { success: false, error: 'Must play a draw card or draw' };
      }
    }

    data.hands[playerId].splice(cardIdx, 1);
    data.discardPile.push(card);

    // Set color
    if (card.color === 'wild') {
      const chosenColor = String(action.payload.color || 'red');
      if (!['red', 'blue', 'green', 'yellow'].includes(chosenColor)) {
        return { success: false, error: 'Invalid color choice' };
      }
      data.currentColor = chosenColor;
    } else {
      data.currentColor = card.color;
    }

    // Apply special effects
    switch (card.value) {
      case 'skip':
        this.advancePlayer(data, players);
        break;
      case 'reverse':
        if (players.length === 2) {
          this.advancePlayer(data, players);
        } else {
          data.direction *= -1;
        }
        break;
      case 'draw2':
        data.drawPending += 2;
        this.advancePlayer(data, players);
        data.mustDraw = true;
        break;
      case 'wild_draw4':
        data.drawPending += 4;
        this.advancePlayer(data, players);
        data.mustDraw = true;
        break;
    }

    // Check win
    if (data.hands[playerId].length === 0) {
      data.winner = playerId;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (!data.mustDraw) {
      this.advancePlayer(data, players);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private advancePlayer(data: UnoState, players: string[]): void {
    data.currentPlayer =
      (((data.currentPlayer + data.direction) % players.length) + players.length) % players.length;
  }

  private ensureDeck(data: UnoState): void {
    if (data.deck.length === 0 && data.discardPile.length > 1) {
      const topCard = data.discardPile.pop()!;
      data.deck = data.discardPile;
      data.discardPile = [topCard];
      for (let i = data.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data.deck[i], data.deck[j]] = [data.deck[j], data.deck[i]];
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<UnoState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<UnoState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<UnoState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      let penalty = 0;
      for (const c of data.hands[p]) {
        if (c.color === 'wild') penalty += 50;
        else if (['skip', 'reverse', 'draw2'].includes(c.value)) penalty += 20;
        else penalty += parseInt(c.value) || 0;
      }
      scores[p] = p === data.winner ? 100 : -penalty;
    }
    return scores;
  }
}
