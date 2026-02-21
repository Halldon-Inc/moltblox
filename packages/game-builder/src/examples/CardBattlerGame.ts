/**
 * CardBattlerGame - Deck combat game
 *
 * Draw, play, and discard cards. Mana starts at 1 and grows each turn.
 * Card types: Attack, Defense, Spell, Creature.
 * Win by reducing opponent HP to 0.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface CardBattlerConfig {
  deckSize?: number;
  handSize?: number;
  manaGrowth?: number;
  startingHp?: number;
  theme?: {
    cardBackColor?: string;
    manaColor?: string;
  };
  gameplay?: {
    startingMana?: number;
    maxMana?: number;
    drawPerTurn?: number;
  };
  content?: {
    cardPool?: Omit<Card, 'id'>[];
  };
}

interface Card {
  id: string;
  name: string;
  type: 'attack' | 'defense' | 'spell' | 'creature';
  manaCost: number;
  value: number;
  effect?: string;
  atk?: number;
  hp?: number;
  [key: string]: unknown;
}

interface Creature {
  id: string;
  name: string;
  atk: number;
  hp: number;
  maxHp: number;
  [key: string]: unknown;
}

interface PlayerState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  armor: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  field: Creature[];
  [key: string]: unknown;
}

interface CBState {
  players: Record<string, PlayerState>;
  turnOrder: string[];
  currentPlayerIndex: number;
  turnNumber: number;
  manaGrowth: number;
  handSize: number;
  manaCap: number;
  drawPerTurn: number;
  gameResult: 'playing' | 'ended';
  [key: string]: unknown;
}

const DEFAULT_STARTING_MANA = 1;
const DEFAULT_MAX_MANA = 10;

// Card templates
const DEFAULT_CARD_POOL: Omit<Card, 'id'>[] = [
  { name: 'Strike', type: 'attack', manaCost: 1, value: 5 },
  { name: 'Slash', type: 'attack', manaCost: 2, value: 8 },
  { name: 'Heavy Blow', type: 'attack', manaCost: 3, value: 13 },
  { name: 'Shield', type: 'defense', manaCost: 1, value: 4 },
  { name: 'Iron Wall', type: 'defense', manaCost: 2, value: 8 },
  { name: 'Fortify', type: 'defense', manaCost: 3, value: 12 },
  { name: 'Draw Power', type: 'spell', manaCost: 1, value: 2, effect: 'draw' },
  { name: 'Healing Light', type: 'spell', manaCost: 2, value: 6, effect: 'heal' },
  { name: 'Double Strike', type: 'spell', manaCost: 3, value: 2, effect: 'double_damage' },
  { name: 'Goblin', type: 'creature', manaCost: 1, value: 0, atk: 2, hp: 2 },
  { name: 'Knight', type: 'creature', manaCost: 3, value: 0, atk: 3, hp: 4 },
  { name: 'Dragon', type: 'creature', manaCost: 5, value: 0, atk: 5, hp: 5 },
];

export class CardBattlerGame extends BaseGame {
  readonly name = 'Card Battler';
  readonly version = '1.0.0';
  readonly maxPlayers = 2;

  protected initializeState(playerIds: string[]): CBState {
    const cfg = this.config as CardBattlerConfig;
    const deckSize = cfg.deckSize ?? 20;
    const handSize = cfg.handSize ?? 5;
    const manaGrowth = cfg.manaGrowth ?? 1;
    const startingHp = cfg.startingHp ?? 30;
    const startingMana = (cfg.gameplay?.startingMana as number) ?? DEFAULT_STARTING_MANA;
    const maxMana = (cfg.gameplay?.maxMana as number) ?? DEFAULT_MAX_MANA;

    const players: Record<string, PlayerState> = {};
    for (const pid of playerIds) {
      const deck = this.buildDeck(deckSize);
      this.shuffleDeck(deck);

      // Draw initial hand
      const hand = deck.splice(0, handSize);

      players[pid] = {
        hp: startingHp,
        maxHp: startingHp,
        mana: startingMana,
        maxMana: startingMana,
        armor: 0,
        hand,
        deck,
        discard: [],
        field: [],
      };
    }

    // Auto-create CPU opponent for single-player mode
    if (playerIds.length === 1) {
      const cpuDeck = this.buildDeck(deckSize);
      this.shuffleDeck(cpuDeck);
      const cpuHand = cpuDeck.splice(0, handSize);
      players['cpu'] = {
        hp: startingHp,
        maxHp: startingHp,
        mana: startingMana,
        maxMana: startingMana,
        armor: 0,
        hand: cpuHand,
        deck: cpuDeck,
        discard: [],
        field: [],
      };
    }

    const allPlayers = playerIds.length === 1 ? [...playerIds, 'cpu'] : [...playerIds];

    return {
      players,
      turnOrder: allPlayers,
      currentPlayerIndex: 0,
      turnNumber: 1,
      manaGrowth,
      handSize,
      manaCap: maxMana,
      drawPerTurn: (cfg.gameplay?.drawPerTurn as number) ?? handSize,
      gameResult: 'playing',
    };
  }

  private buildDeck(size: number): Card[] {
    const cfg = this.config as CardBattlerConfig;
    const pool = (cfg.content?.cardPool as Omit<Card, 'id'>[]) ?? DEFAULT_CARD_POOL;
    const deck: Card[] = [];
    let cardId = 0;
    while (deck.length < size) {
      const template = pool[deck.length % pool.length];
      deck.push({ ...template, id: `card_${cardId++}` } as Card);
    }
    return deck;
  }

  private shuffleDeck(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CBState>();

    if (data.gameResult !== 'playing') {
      return { success: false, error: 'Game is over' };
    }

    const currentPlayer = data.turnOrder[data.currentPlayerIndex];
    if (playerId !== currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    switch (action.type) {
      case 'play_card':
        return this.handlePlayCard(playerId, action, data);
      case 'end_turn':
        return this.handleEndTurn(playerId, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handlePlayCard(playerId: string, action: GameAction, data: CBState): ActionResult {
    const player = data.players[playerId];
    const cardIndex = Number(action.payload.cardIndex);

    if (isNaN(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = player.hand[cardIndex];
    if (player.mana < card.manaCost) {
      return { success: false, error: 'Not enough mana' };
    }

    player.mana -= card.manaCost;
    player.hand.splice(cardIndex, 1);
    player.discard.push(card);

    // Resolve card effect
    const opponentId = data.turnOrder.find((id) => id !== playerId)!;
    const opponent = data.players[opponentId];

    switch (card.type) {
      case 'attack': {
        let damage = card.value;
        // Check double damage buff
        if (player.doubleDamage) {
          damage *= 2;
          player.doubleDamage = false;
        }
        // Armor absorbs damage first
        if (opponent.armor > 0) {
          const absorbed = Math.min(opponent.armor, damage);
          opponent.armor -= absorbed;
          damage -= absorbed;
        }
        opponent.hp -= damage;
        this.emitEvent('card_played', playerId, { card: card.name, damage });
        break;
      }
      case 'defense':
        player.armor += card.value;
        this.emitEvent('card_played', playerId, { card: card.name, armor: card.value });
        break;
      case 'spell':
        this.resolveSpell(card, player, playerId, data);
        break;
      case 'creature':
        player.field.push({
          id: card.id,
          name: card.name,
          atk: card.atk ?? 1,
          hp: card.hp ?? 1,
          maxHp: card.hp ?? 1,
        });
        this.emitEvent('creature_summoned', playerId, { card: card.name });
        break;
    }

    // Check if opponent is dead
    if (opponent.hp <= 0) {
      opponent.hp = 0;
      data.gameResult = 'ended';
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private resolveSpell(card: Card, player: PlayerState, playerId: string, data: CBState): void {
    switch (card.effect) {
      case 'draw': {
        const drawCount = card.value;
        for (let i = 0; i < drawCount; i++) {
          this.drawCard(player);
        }
        this.emitEvent('card_played', playerId, { card: card.name, drawn: drawCount });
        break;
      }
      case 'heal':
        player.hp = Math.min(player.maxHp, player.hp + card.value);
        this.emitEvent('card_played', playerId, { card: card.name, healed: card.value });
        break;
      case 'double_damage':
        player.doubleDamage = true;
        this.emitEvent('card_played', playerId, { card: card.name, effect: 'double_damage' });
        break;
      default:
        this.emitEvent('card_played', playerId, { card: card.name });
    }
  }

  private drawCard(player: PlayerState): void {
    if (player.deck.length === 0) {
      // Reshuffle discard into deck
      if (player.discard.length === 0) return;
      player.deck = [...player.discard];
      player.discard = [];
      this.shuffleDeck(player.deck);
    }
    const card = player.deck.shift();
    if (card) {
      player.hand.push(card);
    }
  }

  private handleEndTurn(playerId: string, data: CBState): ActionResult {
    const player = data.players[playerId];
    const opponentId = data.turnOrder.find((id) => id !== playerId)!;
    const opponent = data.players[opponentId];

    // Creatures attack
    for (const creature of player.field) {
      let damage = creature.atk;
      if (opponent.armor > 0) {
        const absorbed = Math.min(opponent.armor, damage);
        opponent.armor -= absorbed;
        damage -= absorbed;
      }
      opponent.hp -= damage;
      this.emitEvent('creature_attack', playerId, {
        creature: creature.name,
        damage: creature.atk,
      });
    }

    if (opponent.hp <= 0) {
      opponent.hp = 0;
      data.gameResult = 'ended';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Advance to next player
    data.currentPlayerIndex = (data.currentPlayerIndex + 1) % data.turnOrder.length;

    // If it wrapped around, increment turn number and give mana
    if (data.currentPlayerIndex === 0) {
      data.turnNumber++;
    }

    // Give next player mana and draw
    const nextPlayerId = data.turnOrder[data.currentPlayerIndex];
    const nextPlayer = data.players[nextPlayerId];
    nextPlayer.maxMana = Math.min(data.manaCap, nextPlayer.maxMana + data.manaGrowth);
    nextPlayer.mana = nextPlayer.maxMana;

    // Draw to hand size
    const drawTarget = data.drawPerTurn;
    while (nextPlayer.hand.length < drawTarget) {
      this.drawCard(nextPlayer);
    }

    this.emitEvent('turn_ended', playerId, { nextPlayer: nextPlayerId });

    // Auto-play CPU turn in single-player mode
    if (data.turnOrder[data.currentPlayerIndex] === 'cpu') {
      this.autoCpuTurn(data);
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private autoCpuTurn(data: CBState): void {
    const cpu = data.players['cpu'];
    const humanId = data.turnOrder.find((id) => id !== 'cpu')!;
    const human = data.players[humanId];

    // Play affordable attack cards first, targeting the human player
    for (let i = cpu.hand.length - 1; i >= 0; i--) {
      const card = cpu.hand[i];
      if (card.manaCost <= cpu.mana) {
        cpu.mana -= card.manaCost;
        cpu.hand.splice(i, 1);
        cpu.discard.push(card);

        if (card.type === 'attack') {
          let damage = card.value;
          if (human.armor > 0) {
            const absorbed = Math.min(human.armor, damage);
            human.armor -= absorbed;
            damage -= absorbed;
          }
          human.hp -= damage;
          this.emitEvent('card_played', 'cpu', { card: card.name, damage });
        } else if (card.type === 'defense') {
          cpu.armor += card.value;
          this.emitEvent('card_played', 'cpu', { card: card.name, armor: card.value });
        } else if (card.type === 'creature') {
          cpu.field.push({
            id: card.id,
            name: card.name,
            atk: card.atk ?? 1,
            hp: card.hp ?? 1,
            maxHp: card.hp ?? 1,
          });
          this.emitEvent('creature_summoned', 'cpu', { card: card.name });
        }

        if (human.hp <= 0) {
          human.hp = 0;
          data.gameResult = 'ended';
          return;
        }
        break; // Play one card per CPU turn
      }
    }

    // CPU creatures attack
    for (const creature of cpu.field) {
      let damage = creature.atk;
      if (human.armor > 0) {
        const absorbed = Math.min(human.armor, damage);
        human.armor -= absorbed;
        damage -= absorbed;
      }
      human.hp -= damage;
      this.emitEvent('creature_attack', 'cpu', { creature: creature.name, damage: creature.atk });
    }

    if (human.hp <= 0) {
      human.hp = 0;
      data.gameResult = 'ended';
      return;
    }

    // End CPU turn: advance to next player
    data.currentPlayerIndex = (data.currentPlayerIndex + 1) % data.turnOrder.length;
    if (data.currentPlayerIndex === 0) {
      data.turnNumber++;
    }

    // Give next player (human) mana and draw
    const nextId = data.turnOrder[data.currentPlayerIndex];
    const nextPlayer = data.players[nextId];
    nextPlayer.maxMana = Math.min(data.manaCap, nextPlayer.maxMana + data.manaGrowth);
    nextPlayer.mana = nextPlayer.maxMana;
    const drawTarget = data.drawPerTurn;
    while (nextPlayer.hand.length < drawTarget) {
      this.drawCard(nextPlayer);
    }

    this.emitEvent('turn_ended', 'cpu', { nextPlayer: nextId });
  }

  protected checkGameOver(): boolean {
    const data = this.getData<CBState>();
    return data.gameResult === 'ended';
  }

  protected determineWinner(): string | null {
    const data = this.getData<CBState>();
    for (const [pid, pState] of Object.entries(data.players)) {
      if (pState.hp > 0) return pid;
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CBState>();
    const scores: Record<string, number> = {};
    for (const [pid, pState] of Object.entries(data.players)) {
      scores[pid] = Math.max(0, pState.hp) + pState.armor + pState.field.length * 10;
    }
    return scores;
  }
}
