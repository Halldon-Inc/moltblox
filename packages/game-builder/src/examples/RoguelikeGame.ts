/**
 * RoguelikeGame - Procedural dungeon crawler
 *
 * Explore a procedural room graph with monsters, treasure, shops, and traps.
 * Player has HP, ATK, DEF, and an inventory of up to 6 items.
 * Permadeath: game over on 0 HP.
 * Actions: move_to_room, fight, use_item, pick_up, flee.
 */

import { BaseGame } from '../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface RoguelikeConfig {
  roomCount?: number;
  branchFactor?: number;
  itemPoolSize?: number;
  difficultyRamp?: number;
}

type RoomType = 'empty' | 'monster' | 'treasure' | 'shop' | 'boss' | 'trap';

interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'key';
  value: number;
  [key: string]: unknown;
}

interface Monster {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  goldReward: number;
  isBoss: boolean;
  [key: string]: unknown;
}

interface Room {
  id: number;
  type: RoomType;
  connections: number[];
  visited: boolean;
  monster: Monster | null;
  items: Item[];
  shopItems: Item[];
  trapDamage: number;
  locked: boolean;
  [key: string]: unknown;
}

interface PlayerStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  inventory: Item[];
  keys: number;
  [key: string]: unknown;
}

interface RLState {
  rooms: Room[];
  currentRoom: number;
  player: PlayerStats;
  inCombat: boolean;
  currentMonster: Monster | null;
  roomCount: number;
  difficultyRamp: number;
  gameResult: 'playing' | 'won' | 'dead';
  score: number;
  roomsExplored: number;
  [key: string]: unknown;
}

const MONSTER_TEMPLATES = [
  { name: 'Rat', hp: 10, atk: 3, def: 0, goldReward: 5 },
  { name: 'Skeleton', hp: 20, atk: 6, def: 2, goldReward: 10 },
  { name: 'Orc', hp: 35, atk: 8, def: 4, goldReward: 15 },
  { name: 'Wraith', hp: 25, atk: 10, def: 1, goldReward: 20 },
  { name: 'Golem', hp: 50, atk: 7, def: 8, goldReward: 25 },
];

const BOSS_TEMPLATE = { name: 'Dragon Lord', hp: 100, atk: 15, def: 8, goldReward: 100 };

const ITEM_TEMPLATES: Omit<Item, 'id'>[] = [
  { name: 'Rusty Sword', type: 'weapon', value: 3 },
  { name: 'Iron Sword', type: 'weapon', value: 5 },
  { name: 'Flame Blade', type: 'weapon', value: 8 },
  { name: 'Leather Armor', type: 'armor', value: 2 },
  { name: 'Chain Mail', type: 'armor', value: 4 },
  { name: 'Plate Armor', type: 'armor', value: 6 },
  { name: 'Health Potion', type: 'potion', value: 15 },
  { name: 'Greater Potion', type: 'potion', value: 30 },
  { name: 'Skeleton Key', type: 'key', value: 1 },
];

export class RoguelikeGame extends BaseGame {
  readonly name = 'Roguelike';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(_playerIds: string[]): RLState {
    const cfg = this.config as RoguelikeConfig;
    const roomCount = cfg.roomCount ?? 10;
    const branchFactor = cfg.branchFactor ?? 2;
    const difficultyRamp = cfg.difficultyRamp ?? 1.0;

    const rooms = this.generateDungeon(roomCount, branchFactor, difficultyRamp);

    return {
      rooms,
      currentRoom: 0,
      player: {
        hp: 50,
        maxHp: 50,
        atk: 5,
        def: 2,
        gold: 0,
        inventory: [],
        keys: 0,
      },
      inCombat: false,
      currentMonster: null,
      roomCount,
      difficultyRamp,
      gameResult: 'playing',
      score: 0,
      roomsExplored: 1,
    };
  }

  private generateDungeon(roomCount: number, branchFactor: number, ramp: number): Room[] {
    const rooms: Room[] = [];
    let itemCounter = 0;

    for (let i = 0; i < roomCount; i++) {
      let roomType: RoomType;
      if (i === 0) {
        roomType = 'empty'; // Start room
      } else if (i === roomCount - 1) {
        roomType = 'boss';
      } else {
        const roll = Math.random();
        if (roll < 0.35) roomType = 'monster';
        else if (roll < 0.55) roomType = 'treasure';
        else if (roll < 0.7) roomType = 'shop';
        else if (roll < 0.85) roomType = 'trap';
        else roomType = 'empty';
      }

      // Generate connections
      const connections: number[] = [];
      if (i > 0) {
        connections.push(i - 1);
      }
      const forwardCount = Math.min(branchFactor, roomCount - i - 1);
      for (let j = 1; j <= forwardCount; j++) {
        if (i + j < roomCount) {
          connections.push(i + j);
        }
      }

      // Generate room content
      let monster: Monster | null = null;
      const items: Item[] = [];
      const shopItems: Item[] = [];
      let trapDamage = 0;
      const locked = i === roomCount - 1;

      const depthScale = 1 + (i / roomCount) * ramp;

      if (roomType === 'monster') {
        const tmpl = MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];
        monster = {
          ...tmpl,
          hp: Math.floor(tmpl.hp * depthScale),
          maxHp: Math.floor(tmpl.hp * depthScale),
          atk: Math.floor(tmpl.atk * depthScale),
          def: Math.floor(tmpl.def * depthScale),
          goldReward: Math.floor(tmpl.goldReward * depthScale),
          isBoss: false,
        };
      } else if (roomType === 'boss') {
        monster = {
          ...BOSS_TEMPLATE,
          hp: Math.floor(BOSS_TEMPLATE.hp * depthScale),
          maxHp: Math.floor(BOSS_TEMPLATE.hp * depthScale),
          atk: Math.floor(BOSS_TEMPLATE.atk * depthScale),
          def: Math.floor(BOSS_TEMPLATE.def * depthScale),
          goldReward: BOSS_TEMPLATE.goldReward,
          isBoss: true,
        };
      } else if (roomType === 'treasure') {
        const tmpl = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
        items.push({ ...tmpl, id: `item_${itemCounter++}` } as Item);
      } else if (roomType === 'shop') {
        for (let s = 0; s < 3; s++) {
          const tmpl = ITEM_TEMPLATES[Math.floor(Math.random() * ITEM_TEMPLATES.length)];
          shopItems.push({ ...tmpl, id: `item_${itemCounter++}` } as Item);
        }
      } else if (roomType === 'trap') {
        trapDamage = Math.floor(5 + i * 2 * ramp);
      }

      rooms.push({
        id: i,
        type: roomType,
        connections,
        visited: i === 0,
        monster,
        items,
        shopItems,
        trapDamage,
        locked,
      });
    }

    // Ensure bidirectional connections
    for (const room of rooms) {
      for (const connId of room.connections) {
        const target = rooms[connId];
        if (target && !target.connections.includes(room.id)) {
          target.connections.push(room.id);
        }
      }
    }

    return rooms;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<RLState>();

    if (data.gameResult !== 'playing') {
      return { success: false, error: 'Game is over' };
    }

    switch (action.type) {
      case 'move':
      case 'enter_room':
      case 'go':
      case 'move_to_room':
        return this.handleMove(playerId, action, data);
      case 'fight':
        return this.handleFight(playerId, data);
      case 'use_item':
        return this.handleUseItem(playerId, action, data);
      case 'pick_up':
        return this.handlePickUp(playerId, action, data);
      case 'flee':
        return this.handleFlee(playerId, data);
      case 'buy':
        return this.handleBuy(playerId, action, data);
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private handleMove(playerId: string, action: GameAction, data: RLState): ActionResult {
    if (data.inCombat) {
      return { success: false, error: 'Cannot move during combat' };
    }

    const targetRoom = Number(action.payload.roomId);
    const currentRoom = data.rooms[data.currentRoom];

    if (!currentRoom.connections.includes(targetRoom)) {
      return { success: false, error: 'Room not connected' };
    }

    const target = data.rooms[targetRoom];
    if (!target) {
      return { success: false, error: 'Invalid room' };
    }

    if (target.locked && data.player.keys <= 0) {
      return { success: false, error: 'Room is locked, need a key' };
    }

    if (target.locked) {
      data.player.keys--;
      target.locked = false;
    }

    data.currentRoom = targetRoom;
    if (!target.visited) {
      target.visited = true;
      data.roomsExplored++;
      data.score += 5;
    }

    // Handle room entry effects
    if (target.type === 'trap' && target.trapDamage > 0) {
      data.player.hp -= target.trapDamage;
      this.emitEvent('trap_triggered', playerId, { damage: target.trapDamage });
      target.trapDamage = 0;

      if (data.player.hp <= 0) {
        data.player.hp = 0;
        data.gameResult = 'dead';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
    }

    if (
      (target.type === 'monster' || target.type === 'boss') &&
      target.monster &&
      target.monster.hp > 0
    ) {
      data.inCombat = true;
      data.currentMonster = target.monster;
      this.emitEvent('combat_started', playerId, { monster: target.monster.name });
    }

    this.emitEvent('moved', playerId, { room: targetRoom, type: target.type });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFight(playerId: string, data: RLState): ActionResult {
    if (!data.inCombat || !data.currentMonster) {
      return { success: false, error: 'Not in combat' };
    }

    const monster = data.currentMonster;
    const player = data.player;

    // Player attacks
    const playerDmg = Math.max(1, player.atk - monster.def);
    monster.hp -= playerDmg;

    this.emitEvent('player_attack', playerId, { damage: playerDmg, target: monster.name });

    if (monster.hp <= 0) {
      monster.hp = 0;
      data.inCombat = false;
      data.currentMonster = null;
      player.gold += monster.goldReward;
      data.score += monster.isBoss ? 100 : 20;

      // Clear monster from room
      const room = data.rooms[data.currentRoom];
      room.monster = null;

      this.emitEvent('monster_defeated', playerId, {
        monster: monster.name,
        gold: monster.goldReward,
      });

      if (monster.isBoss) {
        data.gameResult = 'won';
        data.score += 200;
      }

      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Monster counterattacks
    const monsterDmg = Math.max(1, monster.atk - player.def);
    player.hp -= monsterDmg;

    this.emitEvent('monster_attack', playerId, { damage: monsterDmg, monster: monster.name });

    if (player.hp <= 0) {
      player.hp = 0;
      data.gameResult = 'dead';
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleUseItem(playerId: string, action: GameAction, data: RLState): ActionResult {
    const itemIndex = Number(action.payload.itemIndex);
    const player = data.player;

    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= player.inventory.length) {
      return { success: false, error: 'Invalid item index' };
    }

    const item = player.inventory[itemIndex];

    switch (item.type) {
      case 'potion':
        player.hp = Math.min(player.maxHp, player.hp + item.value);
        player.inventory.splice(itemIndex, 1);
        this.emitEvent('item_used', playerId, { item: item.name, healed: item.value });
        break;
      case 'weapon':
        player.atk += item.value;
        player.inventory.splice(itemIndex, 1);
        this.emitEvent('item_equipped', playerId, { item: item.name, atk: item.value });
        break;
      case 'armor':
        player.def += item.value;
        player.inventory.splice(itemIndex, 1);
        this.emitEvent('item_equipped', playerId, { item: item.name, def: item.value });
        break;
      case 'key':
        // Keys are used automatically when entering locked rooms
        return { success: false, error: 'Keys are used automatically at locked doors' };
      default:
        return { success: false, error: 'Cannot use this item' };
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handlePickUp(_playerId: string, action: GameAction, data: RLState): ActionResult {
    if (data.inCombat) {
      return { success: false, error: 'Cannot pick up during combat' };
    }

    const room = data.rooms[data.currentRoom];
    const itemIndex = Number(action.payload.itemIndex ?? 0);

    if (itemIndex < 0 || itemIndex >= room.items.length) {
      return { success: false, error: 'No item to pick up' };
    }

    if (data.player.inventory.length >= 6) {
      return { success: false, error: 'Inventory full (max 6)' };
    }

    const item = room.items.splice(itemIndex, 1)[0];
    if (item.type === 'key') {
      data.player.keys++;
    } else {
      data.player.inventory.push(item);
    }
    data.score += 5;

    this.emitEvent('item_picked_up', undefined, { item: item.name });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleBuy(_playerId: string, action: GameAction, data: RLState): ActionResult {
    const room = data.rooms[data.currentRoom];
    if (room.type !== 'shop') {
      return { success: false, error: 'Not in a shop' };
    }

    const itemIndex = Number(action.payload.itemIndex ?? 0);
    if (itemIndex < 0 || itemIndex >= room.shopItems.length) {
      return { success: false, error: 'Invalid shop item' };
    }

    const item = room.shopItems[itemIndex];
    const cost = item.value * 5;

    if (data.player.gold < cost) {
      return { success: false, error: 'Not enough gold' };
    }

    if (data.player.inventory.length >= 6) {
      return { success: false, error: 'Inventory full (max 6)' };
    }

    data.player.gold -= cost;
    room.shopItems.splice(itemIndex, 1);

    if (item.type === 'key') {
      data.player.keys++;
    } else {
      data.player.inventory.push(item);
    }

    this.emitEvent('item_bought', undefined, { item: item.name, cost });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private handleFlee(_playerId: string, data: RLState): ActionResult {
    if (!data.inCombat || !data.currentMonster) {
      return { success: false, error: 'Not in combat' };
    }

    if (data.currentMonster.isBoss) {
      return { success: false, error: 'Cannot flee from a boss' };
    }

    // Take a hit while fleeing
    const fleeDmg = Math.max(1, Math.floor(data.currentMonster.atk * 0.5) - data.player.def);
    data.player.hp -= fleeDmg;

    data.inCombat = false;
    data.currentMonster = null;

    if (data.player.hp <= 0) {
      data.player.hp = 0;
      data.gameResult = 'dead';
    }

    this.emitEvent('fled', undefined, { damage: fleeDmg });
    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const data = this.getData<RLState>();
    return data.gameResult !== 'playing';
  }

  protected determineWinner(): string | null {
    const data = this.getData<RLState>();
    if (data.gameResult === 'won') {
      return this.getPlayers()[0];
    }
    return null;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<RLState>();
    return { [this.getPlayers()[0]]: data.score };
  }
}
