import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type CharacterRole = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

const ALL_ROLES: CharacterRole[] = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

interface PlayerHand {
  cards: CharacterRole[];
  coins: number;
  alive: boolean;
}

interface PendingAction {
  actor: string;
  actionType: string;
  target?: string;
  blockable: boolean;
  challengeable: boolean;
  claimedRole?: CharacterRole;
  resolved: boolean;
  blockedBy?: string;
  blockerClaim?: CharacterRole;
  respondents: string[];
}

interface CoupState {
  [key: string]: unknown;
  hands: Record<string, PlayerHand>;
  deck: CharacterRole[];
  currentPlayer: number;
  pending: PendingAction | null;
  winner: string | null;
  gameEnded: boolean;
  phase: string; // 'action' | 'challenge' | 'block' | 'resolve' | 'lose_card'
  loseCardPlayer: string | null;
  treasury: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class CoupGame extends BaseGame {
  readonly name = 'Coup';
  readonly version = '1.0.0';
  readonly maxPlayers = 6;

  protected initializeState(playerIds: string[]): CoupState {
    // 3 copies of each role = 15 cards
    let deck: CharacterRole[] = [];
    for (const role of ALL_ROLES) {
      deck.push(role, role, role);
    }
    deck = shuffle(deck);

    const hands: Record<string, PlayerHand> = {};
    for (const pid of playerIds) {
      hands[pid] = {
        cards: [deck.pop()!, deck.pop()!],
        coins: 2,
        alive: true,
      };
    }

    return {
      hands,
      deck,
      currentPlayer: 0,
      pending: null,
      winner: null,
      gameEnded: false,
      phase: 'action',
      loseCardPlayer: null,
      treasury: 50 - playerIds.length * 2,
    };
  }

  private getAlivePlayers(): string[] {
    const data = this.getData<CoupState>();
    return this.getPlayers().filter((p) => data.hands[p].alive);
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<CoupState>();
    const players = this.getPlayers();
    const alive = this.getAlivePlayers();

    if (alive.length <= 1) {
      data.gameEnded = true;
      data.winner = alive[0] || null;
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Losing a card phase
    if (data.phase === 'lose_card' && action.type === 'lose_card') {
      if (playerId !== data.loseCardPlayer) {
        return { success: false, error: 'Not your turn to lose a card' };
      }
      const cardIdx = Number(action.payload.cardIndex);
      const hand = data.hands[playerId];
      if (cardIdx < 0 || cardIdx >= hand.cards.length) {
        return { success: false, error: 'Invalid card index' };
      }
      hand.cards.splice(cardIdx, 1);
      if (hand.cards.length === 0) hand.alive = false;

      data.loseCardPlayer = null;
      data.phase = 'action';
      this.advanceTurn(data);
      this.checkEnd(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Pass on challenge/block opportunity
    if (action.type === 'pass' && data.pending) {
      if (!data.pending.respondents.includes(playerId)) {
        data.pending.respondents.push(playerId);
      }
      // Check if all non-actor alive players have responded
      const needResponse = alive.filter((p) => p !== data.pending!.actor);
      const allResponded = needResponse.every((p) => data.pending!.respondents.includes(p));
      if (allResponded) {
        this.resolvePending(data);
      }
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Challenge
    if (action.type === 'challenge' && data.pending && data.pending.challengeable) {
      const actor = data.pending.actor;
      const claimed = data.pending.claimedRole!;
      const actorHand = data.hands[actor];
      const hasRole = actorHand.cards.includes(claimed);

      if (hasRole) {
        // Challenge fails: challenger loses a card
        data.loseCardPlayer = playerId;
        data.phase = 'lose_card';
        // Actor swaps the revealed card back into deck
        const idx = actorHand.cards.indexOf(claimed);
        actorHand.cards.splice(idx, 1);
        data.deck.push(claimed);
        data.deck = shuffle(data.deck);
        actorHand.cards.push(data.deck.pop()!);
        this.resolvePending(data);
      } else {
        // Challenge succeeds: actor loses a card
        data.loseCardPlayer = actor;
        data.phase = 'lose_card';
        data.pending = null;
        this.advanceTurn(data);
      }
      this.checkEnd(data);
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Block
    if (action.type === 'block' && data.pending && data.pending.blockable) {
      data.pending.blockedBy = playerId;
      data.pending.blockerClaim = action.payload.claimedRole as CharacterRole;
      data.pending.challengeable = true;
      data.pending.blockable = false;
      data.pending.respondents = [];
      data.phase = 'challenge';
      this.setData(data);
      return { success: true, newState: this.getState() };
    }

    // Main action phase
    if (data.phase !== 'action') {
      return { success: false, error: 'Not in action phase' };
    }

    const currentAlive = alive;
    const currentId = currentAlive[data.currentPlayer % currentAlive.length];
    if (playerId !== currentId) {
      return { success: false, error: 'Not your turn' };
    }

    const hand = data.hands[playerId];

    switch (action.type) {
      case 'income': {
        hand.coins++;
        data.treasury--;
        this.advanceTurn(data);
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'foreign_aid': {
        data.pending = {
          actor: playerId,
          actionType: 'foreign_aid',
          blockable: true,
          challengeable: false,
          resolved: false,
          respondents: [],
        };
        data.phase = 'block';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'coup': {
        if (hand.coins < 7) return { success: false, error: 'Need 7 coins for coup' };
        const target = action.payload.target as string;
        if (!data.hands[target] || !data.hands[target].alive) {
          return { success: false, error: 'Invalid target' };
        }
        hand.coins -= 7;
        data.treasury += 7;
        data.loseCardPlayer = target;
        data.phase = 'lose_card';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'tax': {
        data.pending = {
          actor: playerId,
          actionType: 'tax',
          challengeable: true,
          blockable: false,
          claimedRole: 'duke',
          resolved: false,
          respondents: [],
        };
        data.phase = 'challenge';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'assassinate': {
        if (hand.coins < 3) return { success: false, error: 'Need 3 coins' };
        const target = action.payload.target as string;
        if (!data.hands[target] || !data.hands[target].alive) {
          return { success: false, error: 'Invalid target' };
        }
        hand.coins -= 3;
        data.treasury += 3;
        data.pending = {
          actor: playerId,
          actionType: 'assassinate',
          target,
          challengeable: true,
          blockable: true,
          claimedRole: 'assassin',
          resolved: false,
          respondents: [],
        };
        data.phase = 'challenge';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'steal': {
        const target = action.payload.target as string;
        if (!data.hands[target] || !data.hands[target].alive) {
          return { success: false, error: 'Invalid target' };
        }
        data.pending = {
          actor: playerId,
          actionType: 'steal',
          target,
          challengeable: true,
          blockable: true,
          claimedRole: 'captain',
          resolved: false,
          respondents: [],
        };
        data.phase = 'challenge';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      case 'exchange': {
        data.pending = {
          actor: playerId,
          actionType: 'exchange',
          challengeable: true,
          blockable: false,
          claimedRole: 'ambassador',
          resolved: false,
          respondents: [],
        };
        data.phase = 'challenge';
        this.setData(data);
        return { success: true, newState: this.getState() };
      }
      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  private resolvePending(data: CoupState): void {
    if (!data.pending || data.pending.resolved) return;
    data.pending.resolved = true;
    const actor = data.pending.actor;
    const hand = data.hands[actor];

    if (data.pending.blockedBy) {
      // Action was blocked
      data.pending = null;
      data.phase = 'action';
      this.advanceTurn(data);
      return;
    }

    switch (data.pending.actionType) {
      case 'foreign_aid':
        hand.coins += 2;
        data.treasury -= 2;
        break;
      case 'tax':
        hand.coins += 3;
        data.treasury -= 3;
        break;
      case 'assassinate':
        if (data.pending.target) {
          data.loseCardPlayer = data.pending.target;
          data.phase = 'lose_card';
          data.pending = null;
          return;
        }
        break;
      case 'steal':
        if (data.pending.target) {
          const targetHand = data.hands[data.pending.target];
          const stolen = Math.min(2, targetHand.coins);
          targetHand.coins -= stolen;
          hand.coins += stolen;
        }
        break;
      case 'exchange': {
        // Draw 2 from deck, pick best 2
        const drawn: CharacterRole[] = [];
        for (let i = 0; i < 2 && data.deck.length > 0; i++) {
          drawn.push(data.deck.pop()!);
        }
        hand.cards.push(...drawn);
        // For simplicity, keep first N cards where N is original hand size (max 2)
        while (hand.cards.length > 2) {
          data.deck.push(hand.cards.pop()!);
        }
        data.deck = shuffle(data.deck);
        break;
      }
    }

    data.pending = null;
    data.phase = 'action';
    this.advanceTurn(data);
  }

  private advanceTurn(data: CoupState): void {
    const alive = this.getPlayers().filter((p) => data.hands[p].alive);
    if (alive.length <= 1) return;
    data.currentPlayer = (data.currentPlayer + 1) % alive.length;
    // Must coup if 10+ coins
    const current = alive[data.currentPlayer];
    if (data.hands[current] && data.hands[current].coins >= 10) {
      // Player must coup on their turn (enforced by rejecting non-coup actions)
    }
  }

  private checkEnd(data: CoupState): void {
    const alive = this.getPlayers().filter((p) => data.hands[p].alive);
    if (alive.length <= 1) {
      data.gameEnded = true;
      data.winner = alive[0] || null;
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<CoupState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<CoupState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<CoupState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) {
      scores[p] = data.hands[p].alive ? 100 + data.hands[p].coins : 0;
    }
    return scores;
  }
}
