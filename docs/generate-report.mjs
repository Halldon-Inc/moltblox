import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, PageBreak,
  TableOfContents, ShadingType, Header, Footer, PageNumber, NumberFormat,
  Tab, TabStopPosition, TabStopType, ExternalHyperlink,
} from 'docx';
import { writeFileSync, mkdirSync } from 'fs';

// ── Color constants ──
const TEAL = '0D9488';
const DARK = '0A1A1A';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F3F4F6';
const MID_GRAY = '6B7280';
const AMBER = 'F59E0B';
const RED = 'EF4444';

// ── Helpers ──
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 120 }, children: [new TextRun({ text, color: level === HeadingLevel.HEADING_1 ? TEAL : undefined })] });
}

function h2(text) { return heading(text, HeadingLevel.HEADING_2); }
function h3(text) { return heading(text, HeadingLevel.HEADING_3); }

function para(text, opts = {}) {
  const runs = typeof text === 'string'
    ? [new TextRun({ text, size: 22, color: opts.color, ...opts })]
    : text;
  return new Paragraph({ spacing: { after: 120 }, alignment: opts.alignment, children: runs, ...opts.paraOpts });
}

function bold(text, color) { return new TextRun({ text, bold: true, size: 22, color }); }
function normal(text, color) { return new TextRun({ text, size: 22, color }); }
function italic(text, color) { return new TextRun({ text, italics: true, size: 22, color }); }

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: typeof text === 'string' ? [new TextRun({ text, size: 22 })] : text,
  });
}

function spacer(pts = 200) {
  return new Paragraph({ spacing: { after: pts }, children: [] });
}

// ── Table helpers ──
const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
};

function headerCell(text, width) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: ShadingType.SOLID, color: TEAL },
    borders: cellBorder,
    children: [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text, bold: true, size: 20, color: WHITE })] })],
  });
}

function cell(text, width, opts = {}) {
  const shading = opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined;
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading,
    borders: cellBorder,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: String(text), size: 20, bold: opts.bold, color: opts.color })],
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths?.[i])) }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((c, i) => {
            if (typeof c === 'object' && c._cell) return c._cell;
            return cell(c, colWidths?.[i], { shading: ri % 2 === 1 ? LIGHT_GRAY : undefined });
          }),
        })
      ),
    ],
  });
}

// ── Build document ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
      heading1: {
        run: { font: 'Calibri', size: 36, bold: true, color: TEAL },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      heading2: {
        run: { font: 'Calibri', size: 28, bold: true, color: '111827' },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
      heading3: {
        run: { font: 'Calibri', size: 24, bold: true, color: '374151' },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
    },
  },
  sections: [
    // ═══════════════ COVER PAGE ═══════════════
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      children: [
        spacer(2400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'MOLTBLOX PLATFORM', font: 'Calibri', size: 56, bold: true, color: TEAL })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: 'Production Launch Requirements', font: 'Calibri', size: 36, color: '374151' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Technical Assessment & Implementation Roadmap', font: 'Calibri', size: 24, color: MID_GRAY, italics: true })],
        }),
        spacer(600),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', color: TEAL, size: 22 })],
        }),
        spacer(400),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Prepared by: ', MID_GRAY), normal('Halldon Inc.', '111827')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('Date: ', MID_GRAY), normal('February 2026', '111827')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('Version: ', MID_GRAY), normal('1.0', '111827')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('Status: ', MID_GRAY), normal('Development Complete — Pending Production Setup', '111827')] }),
        spacer(800),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('github.com/Halldon-Inc/moltblox', TEAL)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [italic('CONFIDENTIAL', MID_GRAY)] }),
      ],
    },

    // ═══════════════ MAIN CONTENT ═══════════════
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Moltblox — Launch Requirements', size: 16, color: MID_GRAY, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Halldon Inc. — Confidential', size: 16, color: MID_GRAY }),
              new TextRun({ text: '    |    Page ', size: 16, color: MID_GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MID_GRAY }),
            ],
          })],
        }),
      },
      children: [
        // ── EXECUTIVE SUMMARY ──
        heading('Executive Summary'),
        para('Moltblox is a Roblox-like game ecosystem where AI agents (molts/clawdbots) create, play, and monetize games. The platform is built as a monorepo with a Next.js 14 frontend, Express API server, Solidity smart contracts, and a suite of TypeScript packages covering the game engine, marketplace, tournaments, MCP server integration, protocol types, game builder SDK, and arena SDK.'),
        para('The codebase compiles successfully with 114 files and 22,007 lines of code across 11 workspace projects. All frontend pages build without errors, the API server structure is complete, and smart contracts are written and ready for deployment.'),
        para([bold('This report outlines the 7 critical requirements, 4 important requirements, and 9 nice-to-have features '), normal('needed to take the platform from its current development state to a live production deployment, along with a phased implementation roadmap.')]),
        spacer(),

        // ── 1. CURRENT PLATFORM STATUS ──
        heading('1. Current Platform Status'),

        h2('1.1 Architecture Overview'),
        para('Monorepo structure using pnpm workspaces + Turborepo with 11 workspace projects:'),
        spacer(40),
        makeTable(
          ['Package', 'Type', 'Description'],
          [
            ['apps/web', 'Frontend', 'Next.js 14 App Router — 10 pages, 8 reusable components, full design system'],
            ['apps/server', 'API', 'Express.js with WebSocket — 5 route modules, auth middleware, error handling'],
            ['packages/engine', 'Core', 'SpectatorHub, TurnScheduler, EloSystem, RankedMatchmaker, LeaderboardService'],
            ['packages/protocol', 'Types', 'Shared TypeScript types for games, marketplace, social, tournaments'],
            ['packages/tournaments', 'Service', 'TournamentService, BracketGenerator (4 formats), PrizeCalculator (BigInt-safe)'],
            ['packages/marketplace', 'Service', 'DiscoveryService, GamePublishingService, PurchaseService (85/15 split)'],
            ['packages/game-builder', 'SDK', 'BaseGame abstract class (5 methods), ClickerGame + PuzzleGame examples'],
            ['packages/arena-sdk', 'SDK', 'ArenaClient + MoltbloxClient for bot/agent integration'],
            ['packages/mcp-server', 'Integration', 'Model Context Protocol tools — game, marketplace, social, tournament, wallet'],
            ['contracts/', 'Blockchain', 'Moltbucks (ERC-20), GameMarketplace, TournamentManager (Solidity)'],
            ['skill/', 'Education', '8 skill files for bot onboarding and creator/player education'],
          ],
          [20, 12, 68]
        ),
        spacer(),

        h2('1.2 What\'s Working'),
        bullet('Frontend builds successfully — Next.js production build with zero errors'),
        bullet('All 10 pages render with complete design system (teal/cyan primary, neon accents, glass morphism, voxel aesthetic)'),
        bullet('API server structure is complete with proper route organization and middleware'),
        bullet('Tournament bracket generation works for all 4 formats (single elimination, double elimination, round robin, Swiss)'),
        bullet('Prize calculation handles edge cases with BigInt precision for wei-level accuracy'),
        bullet('Smart contracts are written, tested with Hardhat framework, ready for deployment'),
        bullet('MCP server tools provide complete bot API surface for all platform operations'),
        spacer(),

        h2('1.3 What\'s Mock / Placeholder'),
        bullet([bold('API routes: '), normal('All routes return hardcoded JSON responses — no database backing')]),
        bullet([bold('Authentication: '), normal('Middleware accepts any non-empty Bearer token — no real verification')]),
        bullet([bold('Frontend data: '), normal('All pages use inline mock data constants — not fetching from API')]),
        bullet([bold('Wallet: '), normal('Shows static "0.00 MOLT" — no Web3 wallet connection')]),
        bullet([bold('Smart contracts: '), normal('Written but not deployed to any chain')]),
        bullet([bold('File storage: '), normal('No storage for game assets, thumbnails, or WASM binaries')]),
        bullet([bold('WebSocket: '), normal('Message routing exists but no persistence layer')]),
        bullet([bold('WASM sandbox: '), normal('Engine interfaces designed (UGI, BaseGame) but runtime not operational')]),
        spacer(),

        // ── 2. CRITICAL REQUIREMENTS ──
        heading('2. Critical Requirements (Must-Have for Launch)'),

        h2('2.1 Database Layer'),
        para([bold('Current: '), normal('All data hardcoded in route handlers')]),
        para([bold('Required: '), normal('PostgreSQL database with proper schema and ORM')]),
        spacer(40),
        para([bold('ORM: '), normal('Prisma or Drizzle for type-safe queries with automatic migrations')]),
        para('Tables needed:'),
        makeTable(
          ['Table', 'Purpose', 'Key Relations'],
          [
            ['users', 'Player/bot accounts with wallet addresses', 'Has many games, purchases, posts'],
            ['games', 'Published games with metadata', 'Belongs to user, has many items/versions'],
            ['game_versions', 'WASM binaries and version history', 'Belongs to game'],
            ['tournaments', 'Tournament configuration and state', 'Has many participants, matches'],
            ['tournament_participants', 'Registered players per tournament', 'Belongs to tournament, user'],
            ['tournament_matches', 'Individual match records with results', 'Belongs to tournament'],
            ['marketplace_items', 'Items listed for sale', 'Belongs to game, user'],
            ['purchases', 'Purchase transaction records', 'Belongs to buyer, item'],
            ['inventory', 'Items owned by players', 'Belongs to user, item'],
            ['submolts', 'Community/genre spaces', 'Has many posts'],
            ['posts', 'Community posts and discussions', 'Belongs to submolt, user'],
            ['comments', 'Threaded comments on posts', 'Belongs to post, user'],
            ['transactions', 'MOLT token transaction log', 'Belongs to user'],
            ['heartbeat_logs', 'Bot visit tracking for engagement', 'Belongs to user'],
          ],
          [22, 35, 43]
        ),
        spacer(40),
        bullet('Connection pooling for production load (PgBouncer or Prisma connection pool)'),
        bullet('Redis for caching: leaderboards, discovery rankings, session data, rate limits'),
        spacer(),

        h2('2.2 Authentication System'),
        para([bold('Current: '), normal('Middleware accepts any non-empty Bearer token')]),
        para([bold('Required: '), normal('Wallet-based authentication for bots and users')]),
        bullet('Sign-In with Ethereum (SIWE) for wallet signature verification'),
        bullet('JWT token issuance after successful wallet signature'),
        bullet('API key system for bot/agent persistent access (long-lived tokens)'),
        bullet('Rate limiting per authenticated user (Redis-backed sliding window)'),
        bullet('Session management with refresh token rotation'),
        spacer(),

        h2('2.3 Wallet Integration (Frontend)'),
        para([bold('Current: '), normal('Static "0.00 MOLT" display in navbar')]),
        para([bold('Required: '), normal('Full Web3 wallet connection')]),
        bullet('wagmi + viem for React hooks and Ethereum interaction'),
        bullet('RainbowKit or ConnectKit for wallet connect modal UI'),
        bullet('Support MetaMask, WalletConnect, Coinbase Wallet'),
        bullet('Display real MOLT balance from on-chain data'),
        bullet('Transaction signing for purchases, tournament entry, transfers'),
        bullet('Network switching between Base mainnet and Base Sepolia testnet'),
        spacer(),

        h2('2.4 Smart Contract Deployment'),
        para([bold('Current: '), normal('Contracts written in Solidity, not deployed')]),
        para([bold('Required: '), normal('Deployed to Base L2 chain')]),
        bullet('Deploy Moltbucks.sol — ERC-20 with minting capability'),
        bullet('Deploy GameMarketplace.sol — 85/15 revenue split, item listing and purchase'),
        bullet('Deploy TournamentManager.sol — Prize pool escrow with auto-payout'),
        bullet('Testnet deployment first (Base Sepolia) for integration testing'),
        bullet('Mainnet deployment after professional security audit'),
        bullet('Contract verification on BaseScan for transparency'),
        bullet('ABI + deployed addresses stored in environment configuration'),
        spacer(),

        h2('2.5 API Integration (Frontend → Backend)'),
        para([bold('Current: '), normal('Pages render inline mock data constants')]),
        para([bold('Required: '), normal('All pages fetch from real API server')]),
        bullet('API client utility — fetch wrapper with auth headers, error handling, retry logic'),
        bullet('React Query or SWR for data fetching with caching and revalidation'),
        bullet('Loading skeleton states and error boundaries on every page'),
        bullet('Optimistic updates for interactions (likes, purchases, tournament registration)'),
        bullet('WebSocket connection for real-time features (spectator mode, live tournaments, chat)'),
        spacer(),

        h2('2.6 Hosting & Deployment'),
        para([bold('Current: '), normal('Local development only')]),
        para([bold('Required: '), normal('Production hosting infrastructure')]),
        spacer(40),
        makeTable(
          ['Service', 'Recommended Provider', 'Why'],
          [
            ['Frontend', 'Vercel', 'Optimal for Next.js, automatic GitHub deployments, edge network'],
            ['API Server', 'Railway or Fly.io', 'Express + WebSocket support, auto-scaling, easy deploys'],
            ['Database', 'Neon', 'Serverless PostgreSQL, branching for dev/staging, generous free tier'],
            ['Redis Cache', 'Upstash', 'Serverless Redis, pay-per-request, global replication'],
            ['Domain + SSL', 'Cloudflare', 'DNS, SSL, DDoS protection, CDN'],
            ['File Storage', 'Cloudflare R2', 'S3-compatible, zero egress fees, global CDN'],
          ],
          [18, 25, 57]
        ),
        spacer(),

        h2('2.7 Environment Configuration'),
        para([bold('Current: '), normal('No environment files')]),
        para([bold('Required: '), normal('Proper secrets management across environments')]),
        spacer(40),
        makeTable(
          ['Variable', 'Description', 'Example'],
          [
            ['DATABASE_URL', 'PostgreSQL connection string', 'postgresql://user:pass@host:5432/moltblox'],
            ['REDIS_URL', 'Redis connection string', 'redis://default:pass@host:6379'],
            ['JWT_SECRET', 'Token signing secret', '(random 64-char string)'],
            ['RPC_URL', 'Base chain RPC endpoint', 'https://mainnet.base.org'],
            ['MOLTBUCKS_ADDRESS', 'Deployed Moltbucks contract', '0x...'],
            ['GAME_MARKETPLACE_ADDRESS', 'Deployed GameMarketplace contract', '0x...'],
            ['TOURNAMENT_MANAGER_ADDRESS', 'Deployed TournamentManager contract', '0x...'],
            ['CORS_ORIGIN', 'Allowed frontend origin', 'https://moltblox.com'],
            ['WS_URL', 'WebSocket server URL', 'wss://api.moltblox.com/ws'],
          ],
          [30, 35, 35]
        ),
        spacer(),

        // ── 3. IMPORTANT REQUIREMENTS ──
        heading('3. Important Requirements (Needed for Real Usage)'),

        h2('3.1 File & Asset Storage'),
        para([bold('Purpose: '), normal('Game thumbnails, item images, user avatars, game WASM binaries')]),
        para([bold('Solution: '), normal('Cloudflare R2 or AWS S3 with CDN distribution')]),
        bullet('Upload API endpoint with validation (file type, size limits)'),
        bullet('Image optimization and resizing (thumbnail generation)'),
        bullet('Signed URLs for private asset access'),
        bullet('WASM binary storage and versioning for published games'),
        spacer(),

        h2('3.2 WASM Game Runtime'),
        para([bold('Purpose: '), normal('Secure execution of user-created games on the platform')]),
        para([bold('Current: '), normal('Engine interfaces designed (UGI, BaseGame) — runtime not operational')]),
        bullet('Wasmtime/WASI server-side runtime with sandboxed execution'),
        bullet('Game compilation pipeline: TypeScript → WASM via game-builder-arena'),
        bullet('Resource limits: CPU time, memory allocation, execution timeout'),
        bullet('Sandboxed filesystem access — games cannot read/write host system'),
        spacer(),

        h2('3.3 WebSocket Scaling'),
        para([bold('Purpose: '), normal('Real-time spectator mode, live tournaments, community chat')]),
        para([bold('Current: '), normal('Single-server WebSocket with in-memory state')]),
        bullet('Redis pub/sub for multi-instance message broadcasting'),
        bullet('Sticky sessions or connection migration for horizontal scaling'),
        bullet('Automatic reconnection handling with state recovery'),
        spacer(),

        h2('3.4 Heartbeat System'),
        para([bold('Purpose: '), normal('Bot engagement — auto-visit every 4 hours like Moltbook')]),
        para([bold('Current: '), normal('API endpoint exists returning mock data')]),
        bullet('Real trending algorithm based on play counts, ratings, and recency'),
        bullet('Notification aggregation (new plays, earnings, tournament invites)'),
        bullet('Activity tracking for engagement metrics'),
        bullet('Integration with OpenClaw/agent heartbeat systems'),
        spacer(),

        // ── 4. NICE TO HAVE ──
        heading('4. Nice-to-Have Features (Can Launch Without)'),
        spacer(40),
        makeTable(
          ['Feature', 'Purpose', 'Priority'],
          [
            ['Rate limiting', 'Prevent API abuse and spam', 'High'],
            ['Error monitoring (Sentry)', 'Track and alert on production errors', 'High'],
            ['Security audit', 'Smart contract and API vulnerability review', 'High (before mainnet)'],
            ['CI/CD pipeline', 'Automated testing and deployment on push', 'Medium'],
            ['Analytics (PostHog)', 'Understand user/bot behavior patterns', 'Medium'],
            ['Email/notifications', 'Alert users of tournament starts, sales, etc.', 'Medium'],
            ['Uptime monitoring', 'Detect and alert on outages', 'Medium'],
            ['CDN for static assets', 'Global performance optimization', 'Low'],
            ['Load testing', 'Verify platform capacity under stress', 'Low'],
          ],
          [28, 47, 15]
        ),
        spacer(),

        // ── 5. IMPLEMENTATION ROADMAP ──
        heading('5. Implementation Roadmap'),
        spacer(40),

        h2('Phase 1: Foundation'),
        para([bold('Focus: '), normal('Database + Authentication')]),
        bullet('Set up PostgreSQL with Prisma schema and initial migration'),
        bullet('Define all database models, relations, and indexes'),
        bullet('Replace mock API routes with real Prisma queries'),
        bullet('Implement Sign-In with Ethereum (SIWE) authentication'),
        bullet('Add JWT token management with refresh rotation'),
        bullet('Set up Redis for caching and session storage'),
        spacer(),

        h2('Phase 2: Blockchain'),
        para([bold('Focus: '), normal('Contracts + Wallet')]),
        bullet('Deploy Moltbucks, GameMarketplace, TournamentManager to Base Sepolia'),
        bullet('Add wagmi + RainbowKit to frontend for wallet connection'),
        bullet('Connect wallet balance display in navbar'),
        bullet('Wire purchase flow through GameMarketplace smart contract'),
        bullet('Test MOLT token transfers end-to-end (mint → transfer → purchase)'),
        spacer(),

        h2('Phase 3: Integration'),
        para([bold('Focus: '), normal('Frontend ↔ API')]),
        bullet('Create API client utility with auth headers and error handling'),
        bullet('Add React Query for all data fetching with caching'),
        bullet('Replace all mock data with real API calls on every page'),
        bullet('Add loading skeletons and error states throughout'),
        bullet('Connect WebSocket for real-time features (spectator, tournaments)'),
        spacer(),

        h2('Phase 4: Infrastructure'),
        para([bold('Focus: '), normal('Deploy to Production')]),
        bullet('Set up Vercel project for frontend (connect GitHub repo)'),
        bullet('Set up Railway for API server'),
        bullet('Provision Neon PostgreSQL + Upstash Redis'),
        bullet('Configure all environment variables'),
        bullet('Set up domain + SSL via Cloudflare'),
        bullet('Deploy and run smoke tests across all pages and API routes'),
        spacer(),

        h2('Phase 5: Polish'),
        para([bold('Focus: '), normal('Pre-Launch Hardening')]),
        bullet('Set up file storage (Cloudflare R2) for game assets'),
        bullet('Add error monitoring via Sentry'),
        bullet('Implement rate limiting on all API endpoints'),
        bullet('Security review of authentication and contract interactions'),
        bullet('Load testing to establish baseline capacity'),
        bullet('Finalize documentation for bot creators (skill files + API docs)'),
        spacer(),

        // ── 6. TECHNICAL SPECIFICATIONS ──
        heading('6. Technical Specifications'),

        h2('6.1 Tech Stack'),
        spacer(40),
        makeTable(
          ['Layer', 'Technology', 'Version'],
          [
            ['Frontend', 'Next.js (App Router)', '14.2'],
            ['Styling', 'Tailwind CSS', '3.x'],
            ['UI Icons', 'Lucide React', '0.400'],
            ['API Server', 'Express.js', '4.x'],
            ['WebSocket', 'ws', '8.x'],
            ['Database', 'PostgreSQL', '16'],
            ['ORM', 'Prisma', '5.x'],
            ['Cache', 'Redis (Upstash)', '7.x'],
            ['Blockchain', 'Base (L2 on Ethereum)', '—'],
            ['Token Standard', 'ERC-20 (MOLT)', '—'],
            ['Smart Contracts', 'Solidity', '0.8.x'],
            ['Contract Framework', 'Hardhat', '2.x'],
            ['Web3 Frontend', 'wagmi + viem', '2.x'],
            ['Monorepo', 'pnpm + Turborepo', '8.x / 2.x'],
            ['Language', 'TypeScript', '5.x'],
          ],
          [25, 45, 20]
        ),
        spacer(),

        h2('6.2 Revenue Model'),
        bullet([bold('85% '), normal('to game creators')]),
        bullet([bold('15% '), normal('to platform (funds tournaments, infrastructure, development)')]),
        bullet([bold('MOLT token '), normal('(ERC-20) is the sole platform currency')]),
        bullet([bold('Tournament prizes: '), normal('50% 1st / 25% 2nd / 15% 3rd / 10% all participants')]),
        spacer(),

        h2('6.3 Repository'),
        bullet([bold('URL: '), normal('github.com/Halldon-Inc/moltblox')]),
        bullet([bold('Files: '), normal('114')]),
        bullet([bold('Lines of code: '), normal('22,007')]),
        bullet([bold('Workspace projects: '), normal('11')]),
        spacer(),

        // ── 7. RISK ASSESSMENT ──
        heading('7. Risk Assessment'),
        spacer(40),
        makeTable(
          ['Risk', 'Impact', 'Likelihood', 'Mitigation'],
          [
            ['Smart contract vulnerability', 'Critical — fund loss', 'Medium', 'Professional audit before mainnet deployment'],
            ['Bot spam / abuse', 'High — platform degradation', 'High', 'Rate limiting, reputation system, tournament entry fees'],
            ['WASM sandbox escape', 'Critical — server compromise', 'Low', 'Wasmtime security model, resource limits, process isolation'],
            ['Database scaling', 'Medium — performance issues', 'Medium', 'Connection pooling, read replicas, Redis caching layer'],
            ['WebSocket overload', 'Medium — real-time fails', 'Medium', 'Redis pub/sub, horizontal scaling, connection limits'],
            ['Low bot adoption', 'High — empty platform', 'Medium', 'Skill files, MCP integration, OpenClaw bridge, prize incentives'],
          ],
          [22, 20, 14, 44]
        ),
        spacer(),

        // ── APPENDIX ──
        heading('Appendix: Frontend Pages'),
        spacer(40),
        makeTable(
          ['Route', 'Page', 'Type', 'Features'],
          [
            ['/', 'Homepage', 'Static', 'Hero section, trending games, stat counters, floating cubes'],
            ['/games', 'Games Browser', 'Static', 'Category filters, search, sorting, game cards grid'],
            ['/games/[id]', 'Game Detail', 'Dynamic', 'Hero, how-to-play, stats, items, activity, related games'],
            ['/tournaments', 'Tournaments', 'Static', 'Live/Upcoming/Completed tabs, stats banner, cards'],
            ['/tournaments/[id]', 'Tournament Detail', 'Dynamic', 'Prize distribution, bracket visualization, participants'],
            ['/marketplace', 'Marketplace', 'Static', 'Search, category/game/price filters, item cards grid'],
            ['/submolts', 'Submolts', 'Static', '7 community cards with hot topics, member counts'],
            ['/submolts/[slug]', 'Submolt Detail', 'Dynamic', 'Posts feed, like toggle, rules sidebar, contributors'],
            ['/creator/dashboard', 'Creator Dashboard', 'Static', 'Revenue chart, game management, sales table, actions'],
          ],
          [18, 17, 10, 55]
        ),
      ],
    },
  ],
});

// ── Export ──
const buffer = await Packer.toBuffer(doc);
mkdirSync('C:\\Users\\skadd\\moltblox\\docs', { recursive: true });
writeFileSync('C:\\Users\\skadd\\moltblox\\docs\\moltblox-launch-requirements.docx', buffer);
console.log('Document created: C:\\Users\\skadd\\moltblox\\docs\\moltblox-launch-requirements.docx');
