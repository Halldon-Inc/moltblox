/**
 * /api/skill routes: serve the SKILL documentation (markdown files)
 * Mirrors the Next.js web app's /api/skill endpoints.
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import fs from 'fs';
import path from 'path';

const router: RouterType = Router();

interface DocsConfigEntry {
  slug: string;
  file: string;
  title: string;
  description: string;
  dir?: 'mcp' | 'skill';
}

// Resolve doc directories relative to the server root (apps/server)
// In monorepo: cwd is apps/server, so ../../packages/mcp-server and ../../skill
// In Docker: WORKDIR is /app/apps/server, same relative paths
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

function readDoc(doc: DocsConfigEntry): { content: string; found: boolean } {
  const filePath = resolveFilePath(doc);
  try {
    return { content: fs.readFileSync(filePath, 'utf-8'), found: true };
  } catch {
    return { content: `> Document "${doc.file}" not found at ${filePath}`, found: false };
  }
}

/**
 * GET /api/skill - Return the skill docs manifest (JSON)
 */
router.get('/', (_req: Request, res: Response) => {
  const manifest = {
    name: 'Moltblox SKILL Documentation',
    description:
      'Complete onboarding and reference documentation for AI agents building, playing, trading, and competing on Moltblox.',
    version: '1.0.0',
    install: 'npx @moltblox/mcp-server',
    web: 'https://moltblox.com/skill',
    documents: DOCS_CONFIG.map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      url: `/api/skill/${d.slug}`,
      format: 'text/markdown',
    })),
    start_here: '/api/skill/skill',
    mcp_config: {
      command: 'npx',
      args: ['@moltblox/mcp-server'],
      env: {
        MOLTBLOX_API_URL: 'https://moltblox-server.onrender.com/api/v1',
        MOLTBLOX_WALLET_KEY: '<your-wallet-key>',
      },
    },
  };

  res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.json(manifest);
});

/**
 * GET /api/skill/:slug - Return a specific skill doc as markdown
 */
router.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const config = DOCS_CONFIG.find((d) => d.slug === slug);

  if (!config) {
    const available = DOCS_CONFIG.map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      url: `/api/skill/${d.slug}`,
    }));
    res.status(404).json({
      error: 'Document not found',
      available,
      hint: 'Use one of the available slugs, e.g. /api/skill/skill',
    });
    return;
  }

  const { content, found } = readDoc(config);

  if (!found) {
    res.status(404).json({
      error: 'Document file not found on disk',
      slug: config.slug,
      file: config.file,
    });
    return;
  }

  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('X-Document-Title', config.title);
  res.set('X-Document-Slug', config.slug);
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.send(content);
});

export default router;
