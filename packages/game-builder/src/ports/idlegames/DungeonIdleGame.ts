import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

interface Hero {
  id: string;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
}

interface DungeonState {
  [key: string]: unknown;
  heroes: Hero[];
  floor: number;
  gold: number;
  totalGold: number;
  monsterHp: number;
  monsterMaxHp: number;
  targetFloor: number;
}

export class DungeonIdleGame extends BaseGame {
  readonly name = 'Dungeon Idle';
  readonly version = '1.0.0';
  readonly maxPlayers = 1;

  protected initializeState(): DungeonState {
    return {
      heroes: [{ id: 'warrior', attack: 5, defense: 2, hp: 50, maxHp: 50 }],
      floor: 1,
      gold: 0,
      totalGold: 0,
      monsterHp: 10,
      monsterMaxHp: 10,
      targetFloor: 10,
    };
  }

  protected processAction(_: string, action: GameAction): ActionResult {
    const d = this.getData<DungeonState>();

    if (action.type === 'fight') {
      const totalAtk = d.heroes.reduce((s, h) => s + h.attack, 0);
      d.monsterHp -= totalAtk;
      // Monster attacks back
      const monsterAtk = d.floor * 3;
      for (const h of d.heroes) {
        const dmg = Math.max(1, monsterAtk - h.defense);
        h.hp -= dmg;
      }
      d.heroes = d.heroes.filter((h) => h.hp > 0);

      if (d.monsterHp <= 0) {
        const reward = d.floor * 20;
        d.gold += reward;
        d.totalGold += reward;
        d.floor++;
        d.monsterMaxHp = d.floor * 15;
        d.monsterHp = d.monsterMaxHp;
      }
    } else if (action.type === 'upgrade') {
      const heroId = action.payload.heroId as string;
      const stat = action.payload.stat as string;
      const hero = d.heroes.find((h) => h.id === heroId);
      if (!hero) return { success: false, error: 'Unknown hero' };
      const cost = 30;
      if (d.gold < cost) return { success: false, error: 'Not enough gold' };
      d.gold -= cost;
      if (stat === 'attack') hero.attack += 3;
      else if (stat === 'defense') hero.defense += 2;
      else if (stat === 'hp') {
        hero.maxHp += 20;
        hero.hp += 20;
      } else return { success: false, error: 'Unknown stat' };
    } else if (action.type === 'rest') {
      for (const h of d.heroes) h.hp = h.maxHp;
    } else {
      return { success: false, error: 'Use fight, upgrade, or rest' };
    }

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    const d = this.getData<DungeonState>();
    return d.floor >= d.targetFloor || d.heroes.length === 0;
  }

  protected determineWinner(): string | null {
    const d = this.getData<DungeonState>();
    return d.floor >= d.targetFloor ? this.getPlayers()[0] : null;
  }

  protected calculateScores(): Record<string, number> {
    const d = this.getData<DungeonState>();
    return { [this.getPlayers()[0]]: d.floor * 100 + d.totalGold };
  }
}
