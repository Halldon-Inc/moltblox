import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

type CardType =
  | 'tempura'
  | 'sashimi'
  | 'dumpling'
  | 'maki1'
  | 'maki2'
  | 'maki3'
  | 'salmon_nigiri'
  | 'squid_nigiri'
  | 'egg_nigiri'
  | 'wasabi'
  | 'pudding'
  | 'chopsticks';

const CARD_DISTRIBUTION: [CardType, number][] = [
  ['tempura', 14],
  ['sashimi', 14],
  ['dumpling', 14],
  ['maki1', 6],
  ['maki2', 12],
  ['maki3', 8],
  ['salmon_nigiri', 10],
  ['squid_nigiri', 5],
  ['egg_nigiri', 5],
  ['wasabi', 6],
  ['pudding', 10],
  ['chopsticks', 4],
];

interface SushiGoPlayerState {
  hand: CardType[];
  played: CardType[];
  pendingWasabi: boolean;
  score: number;
  puddings: number;
  roundScore: number;
}

interface SushiGoState {
  [key: string]: unknown;
  players: Record<string, SushiGoPlayerState>;
  round: number;
  picksThisTurn: Record<string, boolean>;
  winner: string | null;
  gameEnded: boolean;
  deck: CardType[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): CardType[] {
  const deck: CardType[] = [];
  for (const [card, count] of CARD_DISTRIBUTION) {
    for (let i = 0; i < count; i++) deck.push(card);
  }
  return shuffle(deck);
}

export class SushiGoGame extends BaseGame {
  readonly name = 'Sushi Go';
  readonly version = '1.0.0';
  readonly maxPlayers = 5;

  private handSize(playerCount: number): number {
    const sizes: Record<number, number> = { 2: 10, 3: 9, 4: 8, 5: 7 };
    return sizes[playerCount] || 7;
  }

  private dealHands(data: SushiGoState, playerIds: string[]): void {
    const hs = this.handSize(playerIds.length);
    for (const pid of playerIds) {
      data.players[pid].hand = [];
      for (let i = 0; i < hs; i++) {
        if (data.deck.length === 0) data.deck = buildDeck();
        data.players[pid].hand.push(data.deck.pop()!);
      }
      data.players[pid].played = [];
      data.players[pid].pendingWasabi = false;
    }
  }

  protected initializeState(playerIds: string[]): SushiGoState {
    const players: Record<string, SushiGoPlayerState> = {};
    for (const pid of playerIds) {
      players[pid] = {
        hand: [],
        played: [],
        pendingWasabi: false,
        score: 0,
        puddings: 0,
        roundScore: 0,
      };
    }
    const data: SushiGoState = {
      players,
      round: 1,
      picksThisTurn: {},
      winner: null,
      gameEnded: false,
      deck: buildDeck(),
    };
    this.dealHands(data, playerIds);
    return data;
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<SushiGoState>();
    const playerOrder = this.getPlayers();

    if (action.type !== 'pick') return { success: false, error: 'Must pick a card' };
    if (data.picksThisTurn[playerId]) return { success: false, error: 'Already picked this turn' };

    const cardIdx = Number(action.payload.cardIndex);
    const ps = data.players[playerId];
    if (cardIdx < 0 || cardIdx >= ps.hand.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const card = ps.hand[cardIdx];
    ps.hand.splice(cardIdx, 1);
    ps.played.push(card);

    // Handle wasabi: triple next nigiri
    if (card === 'wasabi') {
      ps.pendingWasabi = true;
    }

    data.picksThisTurn[playerId] = true;

    // Check if all players picked
    const allPicked = playerOrder.every((p) => data.picksThisTurn[p]);
    if (allPicked) {
      data.picksThisTurn = {};

      // Check if hands are empty (round over)
      if (ps.hand.length === 0) {
        this.scoreRound(data, playerOrder);
        data.round++;

        if (data.round > 3) {
          this.scorePuddings(data, playerOrder);
          data.gameEnded = true;
          let bestScore = -1;
          let best: string | null = null;
          for (const pid of playerOrder) {
            if (data.players[pid].score > bestScore) {
              bestScore = data.players[pid].score;
              best = pid;
            }
          }
          data.winner = best;
        } else {
          this.dealHands(data, playerOrder);
        }
      } else {
        // Pass hands (clockwise)
        const hands: CardType[][] = playerOrder.map((p) => data.players[p].hand);
        for (let i = 0; i < playerOrder.length; i++) {
          const nextIdx = (i + 1) % playerOrder.length;
          data.players[playerOrder[nextIdx]].hand = hands[i];
        }
      }
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  private scoreRound(data: SushiGoState, playerOrder: string[]): void {
    for (const pid of playerOrder) {
      const ps = data.players[pid];
      let score = 0;
      let tempuraCount = 0;
      let sashimiCount = 0;
      let dumplingCount = 0;
      let makiCount = 0;
      let wasabiPending = false;

      for (const card of ps.played) {
        switch (card) {
          case 'tempura':
            tempuraCount++;
            break;
          case 'sashimi':
            sashimiCount++;
            break;
          case 'dumpling':
            dumplingCount++;
            break;
          case 'maki1':
            makiCount += 1;
            break;
          case 'maki2':
            makiCount += 2;
            break;
          case 'maki3':
            makiCount += 3;
            break;
          case 'egg_nigiri':
            score += wasabiPending ? 3 : 1;
            wasabiPending = false;
            break;
          case 'salmon_nigiri':
            score += wasabiPending ? 6 : 2;
            wasabiPending = false;
            break;
          case 'squid_nigiri':
            score += wasabiPending ? 9 : 3;
            wasabiPending = false;
            break;
          case 'wasabi':
            wasabiPending = true;
            break;
          case 'pudding':
            ps.puddings++;
            break;
          case 'chopsticks':
            break;
        }
      }

      score += Math.floor(tempuraCount / 2) * 5;
      score += Math.floor(sashimiCount / 3) * 10;

      // Dumpling scoring: 1,3,6,10,15
      const dumplingScores = [0, 1, 3, 6, 10, 15];
      score += dumplingScores[Math.min(dumplingCount, 5)];

      ps.roundScore = score;
      ps.score += score;

      // Store maki count for comparison
      (ps as unknown as Record<string, unknown>)._makiCount = makiCount;
    }

    // Maki scoring: most maki = 6 pts, second most = 3 pts
    const makiCounts = playerOrder.map((p) => ({
      pid: p,
      count: (data.players[p] as unknown as Record<string, unknown>)._makiCount as number,
    }));
    makiCounts.sort((a, b) => b.count - a.count);

    if (makiCounts[0].count > 0) {
      const topCount = makiCounts[0].count;
      const topPlayers = makiCounts.filter((m) => m.count === topCount);
      const topPoints = Math.floor(6 / topPlayers.length);
      for (const m of topPlayers) data.players[m.pid].score += topPoints;

      if (topPlayers.length === 1) {
        const secondCount = makiCounts[1]?.count || 0;
        if (secondCount > 0) {
          const secondPlayers = makiCounts.filter(
            (m) => m.count === secondCount && m.pid !== topPlayers[0].pid,
          );
          const secPoints = Math.floor(3 / Math.max(1, secondPlayers.length));
          for (const m of secondPlayers) data.players[m.pid].score += secPoints;
        }
      }
    }

    // Clear played cards (except puddings are tracked separately)
    for (const pid of playerOrder) {
      data.players[pid].played = [];
      delete (data.players[pid] as unknown as Record<string, unknown>)._makiCount;
    }
  }

  private scorePuddings(data: SushiGoState, playerOrder: string[]): void {
    const counts = playerOrder.map((p) => ({ pid: p, count: data.players[p].puddings }));
    const maxPudding = Math.max(...counts.map((c) => c.count));
    const minPudding = Math.min(...counts.map((c) => c.count));

    const mostPlayers = counts.filter((c) => c.count === maxPudding);
    const leastPlayers = counts.filter((c) => c.count === minPudding);

    for (const m of mostPlayers) {
      data.players[m.pid].score += Math.floor(6 / mostPlayers.length);
    }
    if (playerOrder.length > 2) {
      for (const m of leastPlayers) {
        data.players[m.pid].score -= Math.floor(6 / leastPlayers.length);
      }
    }
  }

  protected checkGameOver(): boolean {
    return this.getData<SushiGoState>().gameEnded;
  }

  protected determineWinner(): string | null {
    return this.getData<SushiGoState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    const data = this.getData<SushiGoState>();
    const scores: Record<string, number> = {};
    for (const p of this.getPlayers()) scores[p] = data.players[p].score;
    return scores;
  }
}
