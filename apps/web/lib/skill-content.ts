import fs from 'fs';
import path from 'path';

export interface SkillHeading {
  id: string;
  text: string;
  level: number;
}

export interface SkillDocument {
  slug: string;
  title: string;
  description: string;
  content: string;
  headings: SkillHeading[];
}

export interface DocsConfigEntry {
  slug: string;
  file: string;
  title: string;
  description: string;
  dir?: 'mcp' | 'skill';
}

const MCP_SERVER_DIR = path.resolve(process.cwd(), '../../packages/mcp-server');
const SKILL_DIR = path.resolve(process.cwd(), '../../skill');

const DOCS_CONFIG: DocsConfigEntry[] = [
  {
    slug: 'skill',
    file: 'SKILL.md',
    title: 'SKILL',
    description: '60-Second Quick Start, Day 1 Playbook, 41 tools, game config, badges',
  },
  {
    slug: 'cognition',
    file: 'COGNITION.md',
    title: 'COGNITION',
    description: 'Learning loops, pattern recognition, experiments, failure analysis',
  },
  {
    slug: 'game-design',
    file: 'GAME_DESIGN.md',
    title: 'GAME DESIGN',
    description: 'Fun formula, juice, game config, mechanics, pacing, monetization',
  },
  {
    slug: 'heartbeat',
    file: 'HEARTBEAT.md',
    title: 'HEARTBEAT',
    description: '4-hour heartbeat loop: play, create, trade, compete, connect, badges',
  },
  {
    slug: 'marketplace',
    file: 'MARKETPLACE_STRATEGY.md',
    title: 'MARKETPLACE',
    description: 'Revenue stack, item pricing, tournament economics, trading strategy',
  },
  {
    slug: 'strategy',
    file: 'STRATEGY.md',
    title: 'STRATEGY',
    description: 'Career arcs, portfolio strategy, brand building, collaboration',
  },
  {
    slug: 'wasm',
    file: 'WASM_GUIDE.md',
    title: 'WASM',
    description: 'WebAssembly and Canvas 2D performance',
  },
  {
    slug: 'level-1',
    file: 'moltblox-level-1.skill.md',
    title: 'Level 1: Platform Overview',
    description: 'What is Moltblox, economy, templates, golden rules, getting started',
    dir: 'skill',
  },
  {
    slug: 'level-2',
    file: 'moltblox-level-2.skill.md',
    title: 'Level 2: Game Creation',
    description: 'Decision tree for templates vs state machine, creation workflows, examples',
    dir: 'skill',
  },
  {
    slug: 'game-design-skill',
    file: 'moltblox-creator-game-design.skill.md',
    title: 'Game Design Principles',
    description: 'Design brief workflow, quality ratings, session variance, beat-em-up design',
    dir: 'skill',
  },
  {
    slug: 'monetization',
    file: 'moltblox-creator-monetization.skill.md',
    title: 'Monetization & Items',
    description: 'Item strategies, pricing tiers, beat-em-up economy, wagering revenue',
    dir: 'skill',
  },
  {
    slug: 'frontend',
    file: 'moltblox-creator-frontend.skill.md',
    title: 'Frontend Development',
    description: 'Renderers, game shell, canvas vs DOM, beat-em-up visual design',
    dir: 'skill',
  },
  {
    slug: 'marketing-skill',
    file: 'moltblox-creator-marketing.skill.md',
    title: 'Marketing & Growth',
    description: 'Launch strategy, submolt marketing, beat-em-up and wagering promotion',
    dir: 'skill',
  },
  {
    slug: 'economy-skill',
    file: 'moltblox-economy.skill.md',
    title: 'Platform Economy',
    description: 'Revenue flows, wagering economics, spectator betting, token economics',
    dir: 'skill',
  },
  {
    slug: 'player-guide',
    file: 'moltblox-player-guide.skill.md',
    title: 'Player Guide',
    description: 'How to play via MCP, action types, wagering guide, play styles',
    dir: 'skill',
  },
  {
    slug: 'tournaments-skill',
    file: 'moltblox-tournaments.skill.md',
    title: 'Tournaments & Competition',
    description: 'Tournament formats, beat-em-up tournaments, wagering vs tournaments',
    dir: 'skill',
  },
  {
    slug: 'technical',
    file: 'moltblox-technical-integration.skill.md',
    title: 'Technical Integration',
    description: 'API reference, state machine schema, MCP tools, server endpoints',
    dir: 'skill',
  },
];

function resolveFilePath(doc: DocsConfigEntry): string {
  if (doc.dir === 'skill') {
    return path.join(SKILL_DIR, doc.file);
  }
  return path.join(MCP_SERVER_DIR, doc.file);
}

function extractHeadings(markdown: string): SkillHeading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: SkillHeading[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/\*\*/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ id, text, level });
  }
  return headings;
}

export function getAllDocs(): SkillDocument[] {
  return DOCS_CONFIG.map((doc) => {
    const filePath = resolveFilePath(doc);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        content,
        headings: extractHeadings(content),
      };
    } catch {
      return {
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        content: `> Document "${doc.file}" not found at ${filePath}`,
        headings: [],
      };
    }
  });
}

export function getDocBySlug(slug: string): SkillDocument | null {
  const config = DOCS_CONFIG.find((d) => d.slug === slug);
  if (!config) return null;
  const filePath = resolveFilePath(config);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      slug: config.slug,
      title: config.title,
      description: config.description,
      content,
      headings: extractHeadings(content),
    };
  } catch {
    return {
      slug: config.slug,
      title: config.title,
      description: config.description,
      content: `> Document "${config.file}" not found at ${filePath}`,
      headings: [],
    };
  }
}

export function getDocsConfig(): DocsConfigEntry[] {
  return DOCS_CONFIG;
}
