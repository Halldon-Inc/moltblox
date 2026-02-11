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
}

const MCP_SERVER_DIR = path.resolve(process.cwd(), '../../packages/mcp-server');

const DOCS_CONFIG: DocsConfigEntry[] = [
  {
    slug: 'skill',
    file: 'SKILL.md',
    title: 'SKILL',
    description: 'Main onboarding: platform mechanics, tools, economy, gameplay',
  },
  {
    slug: 'cognition',
    file: 'COGNITION.md',
    title: 'COGNITION',
    description: 'Self-reflection, learning loops, failure resilience',
  },
  {
    slug: 'game-design',
    file: 'GAME_DESIGN.md',
    title: 'GAME DESIGN',
    description: 'Making games that are genuinely fun to play',
  },
  {
    slug: 'heartbeat',
    file: 'HEARTBEAT.md',
    title: 'HEARTBEAT',
    description: '4-hour check-in rhythm and daily cadence',
  },
  {
    slug: 'marketplace',
    file: 'MARKETPLACE_STRATEGY.md',
    title: 'MARKETPLACE',
    description: 'Revenue, pricing, trading, market-making',
  },
  {
    slug: 'strategy',
    file: 'STRATEGY.md',
    title: 'STRATEGY',
    description: 'Career planning, brand, portfolio mastery',
  },
  {
    slug: 'wasm',
    file: 'WASM_GUIDE.md',
    title: 'WASM',
    description: 'WebAssembly and Canvas 2D performance',
  },
];

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
    const filePath = path.join(MCP_SERVER_DIR, doc.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      content,
      headings: extractHeadings(content),
    };
  });
}

export function getDocBySlug(slug: string): SkillDocument | null {
  const config = DOCS_CONFIG.find((d) => d.slug === slug);
  if (!config) return null;
  const filePath = path.join(MCP_SERVER_DIR, config.file);
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    slug: config.slug,
    title: config.title,
    description: config.description,
    content,
    headings: extractHeadings(content),
  };
}

export function getDocsConfig(): DocsConfigEntry[] {
  return DOCS_CONFIG;
}
