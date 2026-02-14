import { BaseGame } from '../../BaseGame.js';
import type { GameAction, ActionResult } from '@moltblox/protocol';

const QUESTIONS = [
  {
    q: 'What planet is closest to the Sun?',
    choices: ['Venus', 'Mercury', 'Mars', 'Earth'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'What is the largest ocean?',
    choices: ['Atlantic', 'Indian', 'Pacific', 'Arctic'],
    answer: 2,
    cat: 'geography',
  },
  {
    q: 'Who painted the Mona Lisa?',
    choices: ['Picasso', 'Da Vinci', 'Van Gogh', 'Monet'],
    answer: 1,
    cat: 'art',
  },
  {
    q: 'What year did WW2 end?',
    choices: ['1943', '1944', '1945', '1946'],
    answer: 2,
    cat: 'history',
  },
  {
    q: 'What is H2O?',
    choices: ['Hydrogen', 'Helium', 'Water', 'Oxygen'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'Which country has the most people?',
    choices: ['USA', 'India', 'China', 'Brazil'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'What is the speed of light in km/s (approx)?',
    choices: ['100,000', '200,000', '300,000', '400,000'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'Who wrote Romeo and Juliet?',
    choices: ['Dickens', 'Shakespeare', 'Austen', 'Twain'],
    answer: 1,
    cat: 'literature',
  },
  {
    q: 'What gas do plants absorb?',
    choices: ['Oxygen', 'Nitrogen', 'CO2', 'Helium'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'What is the capital of Japan?',
    choices: ['Seoul', 'Tokyo', 'Beijing', 'Bangkok'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'How many sides does a hexagon have?',
    choices: ['5', '6', '7', '8'],
    answer: 1,
    cat: 'math',
  },
  {
    q: 'What element has symbol Fe?',
    choices: ['Fluorine', 'Iron', 'Lead', 'Fermium'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'Who discovered gravity?',
    choices: ['Einstein', 'Newton', 'Galileo', 'Tesla'],
    answer: 1,
    cat: 'science',
  },
  { q: 'What is the smallest prime?', choices: ['0', '1', '2', '3'], answer: 2, cat: 'math' },
  {
    q: 'Which planet has rings?',
    choices: ['Mars', 'Jupiter', 'Saturn', 'Neptune'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'What currency does Japan use?',
    choices: ['Won', 'Yen', 'Yuan', 'Baht'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'Who invented the telephone?',
    choices: ['Edison', 'Bell', 'Tesla', 'Morse'],
    answer: 1,
    cat: 'history',
  },
  {
    q: 'What is the boiling point of water in C?',
    choices: ['90', '95', '100', '110'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'What language is spoken in Brazil?',
    choices: ['Spanish', 'Portuguese', 'French', 'English'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'How many continents are there?',
    choices: ['5', '6', '7', '8'],
    answer: 2,
    cat: 'geography',
  },
  {
    q: 'What is the tallest mountain?',
    choices: ['K2', 'Everest', 'Kangchenjunga', 'Denali'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'Who was the first president of the US?',
    choices: ['Adams', 'Washington', 'Jefferson', 'Lincoln'],
    answer: 1,
    cat: 'history',
  },
  {
    q: 'What animal is known as man best friend?',
    choices: ['Cat', 'Dog', 'Horse', 'Parrot'],
    answer: 1,
    cat: 'general',
  },
  {
    q: 'What color do you get mixing red and blue?',
    choices: ['Green', 'Purple', 'Orange', 'Brown'],
    answer: 1,
    cat: 'art',
  },
  {
    q: 'What is the square root of 144?',
    choices: ['10', '11', '12', '13'],
    answer: 2,
    cat: 'math',
  },
  {
    q: 'Which vitamin comes from sunlight?',
    choices: ['A', 'B', 'C', 'D'],
    answer: 3,
    cat: 'science',
  },
  {
    q: 'What is the hardest natural substance?',
    choices: ['Gold', 'Iron', 'Diamond', 'Quartz'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'What instrument has 88 keys?',
    choices: ['Guitar', 'Violin', 'Piano', 'Flute'],
    answer: 2,
    cat: 'music',
  },
  {
    q: 'What is the chemical symbol for gold?',
    choices: ['Go', 'Gd', 'Au', 'Ag'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'Who wrote 1984?',
    choices: ['Huxley', 'Orwell', 'Bradbury', 'Kafka'],
    answer: 1,
    cat: 'literature',
  },
  {
    q: 'What is the longest river?',
    choices: ['Amazon', 'Nile', 'Mississippi', 'Yangtze'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'What does DNA stand for?',
    choices: [
      'Deoxyribonucleic Acid',
      'Digital Network Access',
      'Direct Neuron Adapter',
      'Dynamic Natural Assembly',
    ],
    answer: 0,
    cat: 'science',
  },
  {
    q: 'What sport uses a shuttlecock?',
    choices: ['Tennis', 'Badminton', 'Squash', 'Golf'],
    answer: 1,
    cat: 'sports',
  },
  {
    q: 'What is the freezing point of water in F?',
    choices: ['0', '20', '32', '40'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'How many legs does a spider have?',
    choices: ['6', '8', '10', '12'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'What is the largest mammal?',
    choices: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'Who developed the theory of relativity?',
    choices: ['Newton', 'Einstein', 'Hawking', 'Bohr'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'What is pi rounded to 2 decimals?',
    choices: ['3.12', '3.14', '3.16', '3.18'],
    answer: 1,
    cat: 'math',
  },
  {
    q: 'What country is home to the kangaroo?',
    choices: ['New Zealand', 'Australia', 'South Africa', 'Brazil'],
    answer: 1,
    cat: 'geography',
  },
  {
    q: 'What organ pumps blood?',
    choices: ['Lungs', 'Heart', 'Brain', 'Liver'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'What is the capital of France?',
    choices: ['London', 'Paris', 'Berlin', 'Madrid'],
    answer: 1,
    cat: 'geography',
  },
  { q: 'What note follows "Do Re"?', choices: ['Fa', 'Mi', 'Sol', 'La'], answer: 1, cat: 'music' },
  {
    q: 'How many stripes on the US flag?',
    choices: ['11', '12', '13', '14'],
    answer: 2,
    cat: 'history',
  },
  {
    q: 'What metal is liquid at room temperature?',
    choices: ['Lead', 'Mercury', 'Tin', 'Zinc'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'What shape has 3 sides?',
    choices: ['Square', 'Triangle', 'Pentagon', 'Circle'],
    answer: 1,
    cat: 'math',
  },
  {
    q: 'Who composed the Four Seasons?',
    choices: ['Mozart', 'Vivaldi', 'Bach', 'Beethoven'],
    answer: 1,
    cat: 'music',
  },
  {
    q: 'What blood type is the universal donor?',
    choices: ['A', 'B', 'AB', 'O'],
    answer: 3,
    cat: 'science',
  },
  {
    q: 'What is the main gas in Earth atmosphere?',
    choices: ['Oxygen', 'Nitrogen', 'CO2', 'Argon'],
    answer: 1,
    cat: 'science',
  },
  {
    q: 'How many teeth does an adult have?',
    choices: ['28', '30', '32', '34'],
    answer: 2,
    cat: 'science',
  },
  {
    q: 'What year did humans land on the Moon?',
    choices: ['1967', '1968', '1969', '1970'],
    answer: 2,
    cat: 'history',
  },
];

interface TriviaState {
  [key: string]: unknown;
  questions: typeof QUESTIONS;
  currentQ: number;
  scores: Record<string, number>;
  currentPlayer: number;
  lifelines: Record<string, string[]>;
  totalQuestions: number;
  answered: boolean;
}

export class TriviaGame extends BaseGame {
  readonly name = 'Trivia';
  readonly version = '1.0.0';
  readonly maxPlayers = 4;

  protected initializeState(playerIds: string[]): TriviaState {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
    return {
      questions: shuffled,
      currentQ: 0,
      scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
      currentPlayer: 0,
      lifelines: Object.fromEntries(playerIds.map((p) => [p, ['fifty_fifty', 'skip']])),
      totalQuestions: shuffled.length,
      answered: false,
    };
  }

  protected processAction(playerId: string, action: GameAction): ActionResult {
    const d = this.getData<TriviaState>();
    const players = this.getPlayers();
    if (players[d.currentPlayer] !== playerId) return { success: false, error: 'Not your turn' };

    if (action.type === 'use_lifeline') {
      const type = action.payload.type as string;
      const ll = d.lifelines[playerId];
      const idx = ll.indexOf(type);
      if (idx < 0) return { success: false, error: 'Lifeline unavailable' };
      ll.splice(idx, 1);
      if (type === 'skip') {
        d.currentQ++;
        d.currentPlayer = (d.currentPlayer + 1) % players.length;
        d.answered = false;
      }
      this.setData(d);
      return { success: true, newState: this.getState() };
    }

    if (action.type !== 'answer') return { success: false, error: 'Use answer or use_lifeline' };
    const choice = Number(action.payload.choice);
    const q = d.questions[d.currentQ];
    if (!q) return { success: false, error: 'No more questions' };
    if (choice < 0 || choice >= q.choices.length)
      return { success: false, error: 'Invalid choice' };

    if (choice === q.answer) {
      d.scores[playerId] += 100;
    }

    d.currentQ++;
    d.currentPlayer = (d.currentPlayer + 1) % players.length;
    d.answered = false;

    this.setData(d);
    return { success: true, newState: this.getState() };
  }

  protected checkGameOver(): boolean {
    return this.getData<TriviaState>().currentQ >= this.getData<TriviaState>().totalQuestions;
  }

  protected determineWinner(): string | null {
    const d = this.getData<TriviaState>();
    let best = '',
      bestScore = -1;
    for (const [p, s] of Object.entries(d.scores)) {
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    return bestScore > 0 ? best : null;
  }

  protected calculateScores(): Record<string, number> {
    return { ...this.getData<TriviaState>().scores };
  }
}
