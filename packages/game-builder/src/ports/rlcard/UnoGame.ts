import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface UnoConfig {
  handSize?: number;
}

/**
 * UNO card game. Match color or number, special cards (skip, reverse, draw 2,
 * wild, wild draw 4). First to empty hand wins. 2-4 players.
 */

type UnoColor = 'red' | 'blue' | 'green' | 'yellow';
const COLORS: UnoColor[] = ['red', 'blue', 'green', 'yellow'];

interface UnoCard {
  id: number;
  color: UnoColor | 'wild';
  value: string; // '0'-'9', 'skip', 'reverse', 'draw2', 'wild', 'wild_draw4'
}

interface UnoState {
  [key: string]: unknown;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  hands: Record<string, UnoCard[]>;
  currentPlayer: number;
  direction: number; // 1 or -1
  currentColor: UnoColor;
  winner: string | null;
  pendingDraw: number; // accumulated draw 2 / draw 4 cards
  saidUno: Record<string, boolean>;
}

let unoCardId = 0;

function createUnoDeck(): UnoCard[] {
  unoCardId = 0;
  const deck: UnoCard[] = [];
  const add = (color: UnoColor | 'wild', value: string, count: number) => {
    for (let i = 0; i < count; i++) deck.push({ id: unoCardId++, color, value });
  };

  for (const color of COLORS) {
    add(color, '0', 1);
    for (let n = 1; n <= 9; n++) add(color, String(n), 2);
    add(color, 'skip', 2);
    add(color, 'reverse', 2);
    add(color, 'draw2', 2);
  }
  add('wild', 'wild', 4);
  add('wild', 'wild_draw4', 4);

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class UnoGame extends BaseGame {
  readonly name = 'UNO';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): UnoState {
    const handSize = (this.config as UnoConfig).handSize ?? 7;
    const drawPile = createUnoDeck();
    const hands: Record<string, UnoCard[]> = {};
    for (const pid of playerIds) {
      hands[pid] = [];
      for (let i = 0; i < handSize; i++) {
        if (drawPile.length > 0) hands[pid].push(drawPile.pop()!);
      }
    }

    // Turn over first card for discard (skip wilds)
    let firstCard = drawPile.pop()!;
    while (firstCard.color === 'wild') {
      drawPile.unshift(firstCard);
      firstCard = drawPile.pop()!;
    }

    const saidUno: Record<string, boolean> = {};
    for (const pid of playerIds) saidUno[pid] = false;

    return {
      drawPile,
      discardPile: [firstCard],
      hands,
      currentPlayer: 0,
      direction: 1,
      currentColor: firstCard.color as UnoColor,
      winner: null,
      pendingDraw: 0,
      saidUno,
    };
  }

  private topCard(data: UnoState): UnoCard {
    return data.discardPile[data.discardPile.length - 1];
  }

  private drawCards(data: UnoState, playerId: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (data.drawPile.length === 0) {
        // Reshuffle discard pile (keep top card)
        const top = data.discardPile.pop()!;
        const reshuffled = [...data.discardPile];
        data.discardPile = [top];
        for (let j = reshuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [reshuffled[j], reshuffled[k]] = [reshuffled[k], reshuffled[j]];
        }
        data.drawPile = reshuffled;
      }
      if (data.drawPile.length > 0) {
        data.hands[playerId].push(data.drawPile.pop()!);
      }
    }
  }

  private advance(data: UnoState, skip: boolean): void {
    const players = this.getPlayers();
    const steps = skip ? 2 : 1;
    data.currentPlayer =
      (((data.currentPlayer + data.direction * steps) % players.length) + players.length) %
      players.length;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<UnoState>();
    const players = this.getPlayers();
    const pIdx = data.currentPlayer;

    if (players[pIdx] !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (action.type === 'draw') {
      const drawCount = Math.max(data.pendingDraw, 1);
      this.drawCards(data, playerId, drawCount);
      data.pendingDraw = 0;
      data.saidUno[playerId] = false;
      this.advance(data, false);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type === 'uno') {
      if (data.hands[playerId].length === 2) {
        data.saidUno[playerId] = true;
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'play') {
      return { success: false, error: `Unknown action: ${action.type}` };
    }

    // If there's a pending draw, must draw unless playing a matching draw card
    const cardId = Number(action.payload.cardId);
    const chosenColor = action.payload.color as UnoColor | undefined;

    const hand = data.hands[playerId];
    const cardIdx = hand.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) {
      return { success: false, error: 'Card not in hand' };
    }

    const card = hand[cardIdx];
    const top = this.topCard(data);

    if (data.pendingDraw > 0) {
      // Can only play draw2 on draw2, or wild_draw4
      const canStack =
        (card.value === 'draw2' && top.value === 'draw2') || card.value === 'wild_draw4';
      if (!canStack) {
        return { success: false, error: 'Must draw or stack a draw card' };
      }
    }

    // Check if card is playable
    if (card.color === 'wild') {
      // Always playable
      if (!chosenColor || !COLORS.includes(chosenColor)) {
        return { success: false, error: 'Must choose a color for wild card' };
      }
    } else {
      if (card.color !== data.currentColor && card.value !== top.value) {
        return { success: false, error: 'Card does not match color or value' };
      }
    }

    // Play the card
    hand.splice(cardIdx, 1);
    data.discardPile.push(card);

    // Update color
    if (card.color === 'wild') {
      data.currentColor = chosenColor!;
    } else {
      data.currentColor = card.color as UnoColor;
    }

    // Apply special effects
    let skip = false;
    if (card.value === 'skip') {
      skip = true;
    } else if (card.value === 'reverse') {
      if (players.length === 2) {
        skip = true; // In 2-player, reverse acts like skip
      } else {
        data.direction *= -1;
      }
    } else if (card.value === 'draw2') {
      data.pendingDraw += 2;
    } else if (card.value === 'wild_draw4') {
      data.pendingDraw += 4;
    }

    // Check UNO penalty: if player has 1 card left and didn't say UNO
    if (hand.length === 1 && !data.saidUno[playerId]) {
      this.drawCards(data, playerId, 2); // Penalty
      this.emitEvent('uno_penalty', playerId, {});
    }

    // Check win
    if (hand.length === 0) {
      data.winner = playerId;
      this.emitEvent('win', playerId, {});
    }

    // Reset UNO state
    data.saidUno[playerId] = false;

    this.advance(data, skip);
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  override getStateForPlayer(playerId: string): ReturnType<typeof this.getState> {
    const state = this.getState();
    const data = state.data as UnoState;
    const players = this.getPlayers();
    // Hide other players' hands, show only card count
    const hiddenHands: Record<string, UnoCard[]> = {};
    for (const pid of players) {
      if (pid === playerId) {
        hiddenHands[pid] = data.hands[pid];
      } else {
        hiddenHands[pid] = Array(data.hands[pid].length).fill({
          id: -1,
          color: 'wild',
          value: '?',
        });
      }
    }
    data.hands = hiddenHands;
    return state;
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
    // Winner gets points based on remaining cards in opponents' hands
    const cardValue = (c: UnoCard): number => {
      if (c.value === 'wild' || c.value === 'wild_draw4') return 50;
      if (['skip', 'reverse', 'draw2'].includes(c.value)) return 20;
      return Number(c.value) || 0;
    };
    for (const p of this.getPlayers()) {
      if (p === data.winner) {
        let total = 0;
        for (const pid of this.getPlayers()) {
          if (pid !== p) {
            total += data.hands[pid].reduce((s, c) => s + cardValue(c), 0);
          }
        }
        scores[p] = total;
      } else {
        scores[p] = 0;
      }
    }
    return scores;
  }
}
