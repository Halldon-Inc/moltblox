import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

export interface TriviaChallengeConfig {
  questionsPerRound?: number;
}

interface TriviaQuestion {
  category: string;
  question: string;
  answers: string[];
  correctIndex: number;
}

interface TriviaChallengeState {
  [key: string]: unknown;
  questions: TriviaQuestion[];
  currentQuestion: number;
  currentPlayer: number;
  scores: Record<string, number>;
  totalQuestions: number;
  winner: string | null;
  lastResult: { correct: boolean; correctAnswer: string } | null;
}

const QUESTION_BANK: TriviaQuestion[] = [
  {
    category: 'Science',
    question: 'What is the chemical symbol for gold?',
    answers: ['Go', 'Au', 'Ag', 'Gd'],
    correctIndex: 1,
  },
  {
    category: 'Science',
    question: 'How many planets are in our solar system?',
    answers: ['7', '8', '9', '10'],
    correctIndex: 1,
  },
  {
    category: 'Science',
    question: 'What gas do plants absorb from the atmosphere?',
    answers: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    correctIndex: 2,
  },
  {
    category: 'History',
    question: 'In what year did World War II end?',
    answers: ['1943', '1944', '1945', '1946'],
    correctIndex: 2,
  },
  {
    category: 'History',
    question: 'Who was the first president of the United States?',
    answers: ['Jefferson', 'Adams', 'Washington', 'Franklin'],
    correctIndex: 2,
  },
  {
    category: 'History',
    question: 'The Great Wall is located in which country?',
    answers: ['Japan', 'China', 'India', 'Mongolia'],
    correctIndex: 1,
  },
  {
    category: 'Geography',
    question: 'What is the largest continent by area?',
    answers: ['Africa', 'North America', 'Europe', 'Asia'],
    correctIndex: 3,
  },
  {
    category: 'Geography',
    question: 'Which ocean is the largest?',
    answers: ['Atlantic', 'Indian', 'Pacific', 'Arctic'],
    correctIndex: 2,
  },
  {
    category: 'Geography',
    question: 'What is the capital of Australia?',
    answers: ['Sydney', 'Melbourne', 'Canberra', 'Perth'],
    correctIndex: 2,
  },
  {
    category: 'Math',
    question: 'What is the square root of 144?',
    answers: ['10', '11', '12', '14'],
    correctIndex: 2,
  },
  {
    category: 'Math',
    question: 'What is 7 x 8?',
    answers: ['54', '56', '58', '63'],
    correctIndex: 1,
  },
  {
    category: 'Math',
    question: 'How many sides does a hexagon have?',
    answers: ['5', '6', '7', '8'],
    correctIndex: 1,
  },
  {
    category: 'Nature',
    question: 'What is the fastest land animal?',
    answers: ['Lion', 'Cheetah', 'Horse', 'Antelope'],
    correctIndex: 1,
  },
  {
    category: 'Nature',
    question: 'How many legs does a spider have?',
    answers: ['6', '8', '10', '12'],
    correctIndex: 1,
  },
  {
    category: 'Nature',
    question: 'What is the largest mammal?',
    answers: ['Elephant', 'Giraffe', 'Blue whale', 'Hippo'],
    correctIndex: 2,
  },
  {
    category: 'Tech',
    question: 'What does CPU stand for?',
    answers: [
      'Central Processing Unit',
      'Computer Personal Unit',
      'Central Program Utility',
      'Core Processing Unit',
    ],
    correctIndex: 0,
  },
  {
    category: 'Tech',
    question: 'Who created the World Wide Web?',
    answers: ['Bill Gates', 'Steve Jobs', 'Tim Berners-Lee', 'Linus Torvalds'],
    correctIndex: 2,
  },
  {
    category: 'Tech',
    question: 'What does HTML stand for?',
    answers: [
      'Hyper Text Markup Language',
      'High Tech Modern Language',
      'Hyper Transfer Markup Language',
      'Home Tool Markup Language',
    ],
    correctIndex: 0,
  },
  {
    category: 'Sports',
    question: 'How many players are on a basketball team on court?',
    answers: ['4', '5', '6', '7'],
    correctIndex: 1,
  },
  {
    category: 'Sports',
    question: 'In which sport is a shuttlecock used?',
    answers: ['Tennis', 'Badminton', 'Squash', 'Table Tennis'],
    correctIndex: 1,
  },
];

export class TriviaChallengeGame extends BaseGame {
  readonly name = 'Trivia Challenge';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): TriviaChallengeState {
    const perRound = (this.config as TriviaChallengeConfig).questionsPerRound ?? 10;
    const totalQuestions = Math.min(perRound, QUESTION_BANK.length);

    const shuffled = [...QUESTION_BANK];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const scores: Record<string, number> = {};
    for (const p of playerIds) scores[p] = 0;

    return {
      questions: shuffled.slice(0, totalQuestions),
      currentQuestion: 0,
      currentPlayer: 0,
      scores,
      totalQuestions,
      winner: null,
      lastResult: null,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const data = this.getData<TriviaChallengeState>();
    const players = this.getPlayers();

    if (players[data.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };
    if (action.type !== 'answer')
      return { success: false, error: `Unknown action: ${action.type}` };

    const answerIndex = Number(action.payload.answerIndex);
    const q = data.questions[data.currentQuestion];

    if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= q.answers.length) {
      return { success: false, error: 'Invalid answer index' };
    }

    const correct = answerIndex === q.correctIndex;
    if (correct) data.scores[playerId] += 10;

    data.lastResult = { correct, correctAnswer: q.answers[q.correctIndex] };

    data.currentPlayer = (data.currentPlayer + 1) % players.length;
    if (data.currentPlayer === 0) data.currentQuestion++;

    if (data.currentQuestion >= data.totalQuestions) {
      let bestPlayer: string | null = null;
      let bestScore = -1;
      for (const p of players) {
        if (data.scores[p] > bestScore) {
          bestScore = data.scores[p];
          bestPlayer = p;
        }
      }
      data.winner = bestPlayer;
    }

    this.setData(data);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TriviaChallengeState>().winner !== null;
  }

  protected determineWinner(): string | null {
    return this.getData<TriviaChallengeState>().winner;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<TriviaChallengeState>().scores };
  }
}
