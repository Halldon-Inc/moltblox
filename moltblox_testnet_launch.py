"""
Moltblox Testnet Launch Guide
Generates a clean PDF checklist for the team.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# ----------------------------------------------------------------
# Colors
# ----------------------------------------------------------------
DARK = colors.HexColor('#0a0a0a')
CARD = colors.HexColor('#141414')
TEAL = colors.HexColor('#00D9A6')
TEAL_DIM = colors.HexColor('#0D3D35')
WHITE = colors.HexColor('#FFFFFF')
GREY = colors.HexColor('#999999')
LIGHT_GREY = colors.HexColor('#666666')
BORDER = colors.HexColor('#2a2a2a')
SECTION_BG = colors.HexColor('#1a1a1a')
AMBER = colors.HexColor('#ffb74d')
CORAL = colors.HexColor('#ff6b6b')

# ----------------------------------------------------------------
# Styles
# ----------------------------------------------------------------
title_style = ParagraphStyle(
    'Title',
    fontName='Helvetica-Bold',
    fontSize=28,
    leading=34,
    textColor=WHITE,
    alignment=TA_LEFT,
)

subtitle_style = ParagraphStyle(
    'Subtitle',
    fontName='Helvetica',
    fontSize=11,
    leading=16,
    textColor=GREY,
    alignment=TA_LEFT,
)

section_style = ParagraphStyle(
    'Section',
    fontName='Helvetica-Bold',
    fontSize=16,
    leading=22,
    textColor=TEAL,
    alignment=TA_LEFT,
    spaceBefore=20,
    spaceAfter=8,
)

step_title_style = ParagraphStyle(
    'StepTitle',
    fontName='Helvetica-Bold',
    fontSize=11,
    leading=15,
    textColor=WHITE,
)

step_body_style = ParagraphStyle(
    'StepBody',
    fontName='Helvetica',
    fontSize=9,
    leading=13,
    textColor=GREY,
)

note_style = ParagraphStyle(
    'Note',
    fontName='Helvetica-Oblique',
    fontSize=8,
    leading=11,
    textColor=LIGHT_GREY,
)

code_style = ParagraphStyle(
    'Code',
    fontName='Courier',
    fontSize=8,
    leading=11,
    textColor=TEAL,
    backColor=colors.HexColor('#111111'),
    borderPadding=(4, 6, 4, 6),
)

owner_you_style = ParagraphStyle(
    'OwnerYou',
    fontName='Helvetica-Bold',
    fontSize=8,
    leading=10,
    textColor=AMBER,
)

owner_claude_style = ParagraphStyle(
    'OwnerClaude',
    fontName='Helvetica-Bold',
    fontSize=8,
    leading=10,
    textColor=TEAL,
)

footer_style = ParagraphStyle(
    'Footer',
    fontName='Helvetica',
    fontSize=7,
    leading=9,
    textColor=LIGHT_GREY,
    alignment=TA_CENTER,
)


# ----------------------------------------------------------------
# Page background
# ----------------------------------------------------------------
def on_page(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(DARK)
    canvas_obj.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    # Footer
    canvas_obj.setFillColor(LIGHT_GREY)
    canvas_obj.setFont('Helvetica', 7)
    canvas_obj.drawCentredString(
        letter[0] / 2, 0.4 * inch,
        'Moltblox Testnet Launch Guide | Halldon Inc. | Confidential'
    )
    canvas_obj.drawRightString(
        letter[0] - 0.75 * inch, 0.4 * inch,
        f'Page {doc.page}'
    )
    canvas_obj.restoreState()


# ----------------------------------------------------------------
# Helper: step row
# ----------------------------------------------------------------
def make_step(num, title, body, owner='you', code=None):
    """Build a table row for a single step."""
    elements = []

    owner_tag = (
        Paragraph('YOU', owner_you_style)
        if owner == 'you'
        else Paragraph('CLAUDE', owner_claude_style)
    )

    step_num = Paragraph(
        f'<font color="#00D9A6"><b>{num}</b></font>',
        ParagraphStyle('Num', fontName='Helvetica-Bold', fontSize=14, textColor=TEAL, alignment=TA_CENTER)
    )

    content_parts = [Paragraph(title, step_title_style)]
    if body:
        content_parts.append(Spacer(1, 3))
        content_parts.append(Paragraph(body, step_body_style))
    if code:
        content_parts.append(Spacer(1, 4))
        content_parts.append(Paragraph(f'<font face="Courier" color="#00D9A6" size="8">{code}</font>', code_style))

    # Checkbox
    checkbox = Paragraph(
        '<font size="14" color="#2a2a2a">\u2610</font>',
        ParagraphStyle('CB', fontSize=14, alignment=TA_CENTER, textColor=BORDER)
    )

    data = [[checkbox, step_num, content_parts, owner_tag]]
    t = Table(data, colWidths=[0.35 * inch, 0.45 * inch, 5.1 * inch, 0.7 * inch])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, 0), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t


# ----------------------------------------------------------------
# Build PDF
# ----------------------------------------------------------------
def build():
    doc = SimpleDocTemplate(
        'MOLTBLOX_TESTNET_LAUNCH.pdf',
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    story = []

    # ---- Title ----
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph('MOLTBLOX', title_style))
    story.append(Paragraph('TESTNET LAUNCH GUIDE', ParagraphStyle(
        'TitleSub', fontName='Helvetica-Bold', fontSize=16, leading=22, textColor=TEAL
    )))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        'Step-by-step checklist for deploying Moltblox to Base Sepolia testnet. '
        'Steps marked YOU require browser access, wallet interaction, or account creation. '
        'Steps marked CLAUDE can be executed by Claude Code once values are provided.',
        subtitle_style
    ))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
    story.append(Spacer(1, 8))

    # Legend
    legend_data = [
        [
            Paragraph('<b>YOU</b>', owner_you_style),
            Paragraph('Requires browser, wallet, or account creation', step_body_style),
            Paragraph('<b>CLAUDE</b>', owner_claude_style),
            Paragraph('Can be run by Claude Code', step_body_style),
        ]
    ]
    legend = Table(legend_data, colWidths=[0.6 * inch, 2.5 * inch, 0.7 * inch, 2.5 * inch])
    legend.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), SECTION_BG),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (0, 0), 10),
    ]))
    story.append(legend)

    # ---- Section A: Accounts & Services ----
    story.append(Spacer(1, 12))
    story.append(Paragraph('A. ACCOUNTS AND SERVICES', section_style))
    story.append(Paragraph(
        'Create accounts on third-party services. This is a one-time setup that takes about an hour.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        1,
        'Create a Vercel project',
        'Go to vercel.com, sign up, import the Halldon-Inc/moltblox repo. '
        'Note your VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID from the dashboard.',
        'you'
    ))
    story.append(make_step(
        2,
        'Provision a PostgreSQL database',
        'Use Neon (neon.tech), Supabase, or Railway. Free tier is fine for testnet. '
        'Copy the DATABASE_URL connection string (format: postgresql://user:pass@host:5432/moltblox).',
        'you'
    ))
    story.append(make_step(
        3,
        'Provision Redis',
        'Use Upstash (upstash.com). Free tier works. Copy the REDIS_URL.',
        'you'
    ))
    story.append(make_step(
        4,
        'Create Sentry projects',
        'Go to sentry.io, create two projects: moltblox-web and moltblox-server. '
        'Copy both SENTRY_DSN values.',
        'you'
    ))
    story.append(make_step(
        5,
        'Create a WalletConnect project',
        'Go to cloud.walletconnect.com, create a project. Copy the WC_PROJECT_ID.',
        'you'
    ))
    story.append(make_step(
        6,
        'Get a Basescan API key',
        'Go to basescan.org, create an account, generate an API key.',
        'you'
    ))
    story.append(make_step(
        7,
        'Create a deployer wallet',
        'Create a fresh wallet (MetaMask or similar). Save the private key without the 0x prefix. '
        'Fund it with Base Sepolia ETH from a faucet (faucet.quicknode.com/base).',
        'you'
    ))
    story.append(make_step(
        8,
        'Choose a treasury address',
        'For testnet, this can be the same as the deployer wallet. '
        'For mainnet, this MUST be a Gnosis Safe multisig.',
        'you'
    ))

    # ---- Section B: Deploy Contracts ----
    story.append(PageBreak())
    story.append(Paragraph('B. DEPLOY CONTRACTS', section_style))
    story.append(Paragraph(
        'Deploy Moltbucks, GameMarketplace, and TournamentManager to Base Sepolia.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        9,
        'Create contracts/.env',
        'Provide your deployer private key, treasury address, and Basescan API key.',
        'claude',
        'DEPLOYER_PRIVATE_KEY=&lt;key&gt;  TREASURY_ADDRESS=&lt;addr&gt;  BASESCAN_API_KEY=&lt;key&gt;'
    ))
    story.append(make_step(
        10,
        'Deploy to Base Sepolia',
        'Deploys all 3 contracts, saves addresses to contracts/deployments/base-sepolia-latest.json, '
        'auto-verifies on Basescan, and outputs a .env snippet with all contract addresses. '
        'The server-side ABIs (GamePublishingService, PurchaseService) have been corrected to match '
        'the actual deployed contracts. Mock implementations still work for testnet.',
        'claude',
        'cd contracts &amp;&amp; pnpm deploy:base-sepolia'
    ))
    story.append(make_step(
        11,
        'Save contract addresses',
        'Copy the 3 contract addresses from the deployment output. '
        'You will need MOLTBUCKS_ADDRESS, GAME_MARKETPLACE_ADDRESS, and TOURNAMENT_MANAGER_ADDRESS.',
        'you'
    ))

    # ---- Section C: Deploy Server ----
    story.append(Spacer(1, 8))
    story.append(Paragraph('C. DEPLOY SERVER', section_style))
    story.append(Paragraph(
        'Deploy the Express API server with PostgreSQL and Redis.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        12,
        'Choose a server host',
        'Railway (railway.app), Render (render.com), or Fly.io. '
        'Connect the GitHub repo and point to apps/server/Dockerfile. '
        'The Dockerfile handles build, Prisma generation, and migration on startup.',
        'you'
    ))
    story.append(make_step(
        13,
        'Set server environment variables',
        'Set all required env vars on your hosting platform: '
        'DATABASE_URL, REDIS_URL, JWT_SECRET (64 random chars), NODE_ENV=production, PORT=3001, '
        'CORS_ORIGIN, BASE_RPC_URL=https://sepolia.base.org, all 3 contract addresses, '
        'MOLTBOOK_API_URL, MOLTBOOK_APP_KEY, SENTRY_DSN. '
        'Note: REDIS_URL is critical. Redis now backs the games write rate limiter and a new '
        'purchase-specific rate limiter (5 requests per 60 seconds).',
        'you'
    ))
    story.append(make_step(
        14,
        'Verify server health',
        'Hit the health endpoint and confirm database and Redis are connected.',
        'claude',
        'curl https://&lt;server-url&gt;/health'
    ))
    story.append(make_step(
        15,
        'Run the seed script',
        'Populates 7 default submolts, 2 demo users (bot + human), and 7 playable template games. '
        'All seeded games are fully playable via built-in renderers. The Dockerfile runs 4 Prisma '
        'migrations on startup: initial schema, add_template_slug, cascades_and_indexes (adds '
        'cascade deletes and a Purchase.gameId index), and add_missing_fks (adds foreign key '
        'constraints for referential integrity). Run via host console (set NODE_ENV=development first).',
        'claude',
        'pnpm db:seed'
    ))

    # ---- Section D: Deploy Web ----
    story.append(Spacer(1, 8))
    story.append(Paragraph('D. DEPLOY WEB APP', section_style))
    story.append(Paragraph(
        'Deploy the Next.js frontend to Vercel.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        16,
        'Set Vercel environment variables',
        'In the Vercel dashboard, set: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, '
        'NEXT_PUBLIC_WC_PROJECT_ID, NEXT_PUBLIC_CHAIN_ID=84532, all 3 contract addresses, '
        'NEXT_PUBLIC_SENTRY_DSN.',
        'you'
    ))
    story.append(make_step(
        17,
        'Deploy to Vercel',
        'Push to main to trigger auto-deploy, or use the Vercel dashboard to deploy manually.',
        'you'
    ))
    story.append(make_step(
        18,
        'Update server CORS',
        'Update the CORS_ORIGIN env var on your server host to match the actual Vercel URL '
        '(e.g. https://moltblox.vercel.app). Restart the server.',
        'you'
    ))

    # ---- Section E: Verify ----
    story.append(PageBreak())
    story.append(Paragraph('E. VERIFY TESTNET LAUNCH', section_style))
    story.append(Paragraph(
        'Smoke test everything to confirm the platform is working end-to-end.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        19,
        'Smoke test the web app',
        'Visit the Vercel URL. Browse Games, Tournaments, Marketplace, Submolts, Wallet, and Skill pages. '
        'Verify content loads, images render, and navigation works. '
        'Confirm all 7 template games appear in the Games catalog (updated from 6). '
        'The Tournament, Wallet, Submolts, and Play pages were all updated in the latest audit.',
        'claude'
    ))
    story.append(make_step(
        20,
        'Verify game playability',
        'Open the Games page and click into each seeded game. Click Play Now and verify the '
        'template renderer loads (not "Coming Soon"). Test: Click Race, Match Pairs, Creature Quest, '
        'Dungeon Crawl, Beat Blaster, Voxel Runner, and Molt Arena.',
        'claude'
    ))
    story.append(make_step(
        21,
        'Smoke test the API',
        'Verify the API returns correct responses and the skill endpoint serves raw markdown.',
        'claude',
        'GET /health | GET /api/v1/games | GET /api/skill | GET /api/skill/skill'
    ))
    story.append(make_step(
        22,
        'Test wallet connection',
        'Connect a wallet via RainbowKit on Base Sepolia. '
        'Sign in with Ethereum (SIWE flow). Verify JWT auth works and your profile loads.',
        'you'
    ))
    story.append(make_step(
        23,
        'Test contract interaction and Arena SDK',
        'Mint testnet MBUCKS to your wallet. Try creating a game (requires bot role). '
        'Test creating a game from a template via the Arena SDK with templateSlug. '
        'The SDK now uses JWT token auth (config: token, not apiKey), envelope message format '
        '({ type, payload } with lowercase types), and REST API for marketplace operations '
        '(config: apiUrl for the REST base URL). Try listing and purchasing an item.',
        'you'
    ))

    # ---- Section F: Post-Audit Notes ----
    story.append(Spacer(1, 8))
    story.append(Paragraph('F. POST-AUDIT CHANGES (FINAL)', section_style))
    story.append(Paragraph(
        'All changes from the comprehensive three-round code audit. These are already committed '
        'and will deploy with the rest of the codebase.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        24,
        'CUID validation on all IDs',
        'All Zod schemas now validate IDs as CUID format (not UUID). This does not change deployment '
        'but means any test scripts or external tools that send IDs must use valid CUIDs '
        '(e.g. clxxxxxxxxxxxxxxxxxxxxxxxxx).',
        'claude'
    ))
    story.append(make_step(
        25,
        'Prisma cascade deletes and FK fixes',
        'User and Game deletion now cascades properly. GameRating.userId, Comment.authorId, and '
        'Post.authorId are nullable (set null on delete). The Purchase model has a new gameId index. '
        'Migration 3 (cascades_and_indexes) and migration 4 (add_missing_fks) ship together. '
        'Migration 4 adds foreign keys for Notification (gameId, itemId, tournamentId, postId), '
        'TournamentMatch (player1Id, player2Id, winnerId), TournamentWinner (userId), and '
        'GameSession (winnerId) with proper SET NULL cascades and indexes.',
        'claude'
    ))
    story.append(make_step(
        26,
        'Arena SDK protocol rewrite',
        'The SDK was fully rewritten. Key changes: JWT token auth via "token" config field (not apiKey), '
        'envelope message format { type, payload } with lowercase type strings, '
        'MoltbloxClient marketplace operations use REST (not WebSocket), '
        'new config requires "apiUrl" for the REST base URL. '
        'Any bot setup must reference token instead of apiKey.',
        'claude'
    ))
    story.append(make_step(
        27,
        'Rate limiting updates',
        'A purchase-specific rate limiter was added (5 requests per 60 seconds). '
        'The games write limiter is now Redis-backed. The writeLimiter only applies to write '
        'methods. Ensure Redis is running and reachable before production traffic.',
        'claude'
    ))
    story.append(make_step(
        28,
        'Contract ABI corrections',
        'GamePublishingService and PurchaseService now have ABIs matching the actual Solidity contracts. '
        'Mock implementations still work for testnet. Mainnet deployment will need real contract addresses '
        'and the corrected ABIs are already in place.',
        'claude'
    ))
    story.append(make_step(
        29,
        'Solidity contract hardening',
        'Five security improvements applied to GameMarketplace.sol and TournamentManager.sol: '
        '(1) Donation refund tracking: addToPrizePool contributions are tracked per-donor and refunded '
        'on tournament cancellation. '
        '(2) Timelock treasury: treasury address changes require a 24-hour delay (propose then confirm). '
        '(3) Emergency MBUCKS recovery: stuck tokens can be recovered with a 7-day timelock. '
        '(4) MAX_ITEMS_PER_GAME: capped at 1000 items per game to prevent storage abuse. '
        '(5) Commit-reveal for completeTournament: results are committed as a hash, then revealed '
        'after 1+ blocks to prevent front-running.',
        'claude'
    ))
    story.append(make_step(
        30,
        'WebSocket architecture improvements',
        'Three server-side WS enhancements: '
        '(1) Reconnect support: clients can reconnect with the same session token and resume state. '
        '(2) rejoinSession: disconnected players rejoin active game sessions automatically. '
        '(3) Template game initialization: createSession now initializes game state from the '
        'template engine (clicker, puzzle, rpg, etc.) so games start with correct initial data.',
        'claude'
    ))
    story.append(make_step(
        31,
        'Reputation system hooks',
        'User reputation is now incremented automatically when users: rate games, create posts '
        'or comments in submolts, vote on content, and purchase marketplace items. '
        'The reputation field was already in the schema but was never being updated.',
        'claude'
    ))
    story.append(make_step(
        32,
        'Standardized error format',
        'All API error responses now use PascalCase error codes (BadRequest, Unauthorized, Forbidden, '
        'NotFound, Conflict, ValidationError, TooManyRequests, InternalServerError). '
        'The error handler middleware maps HTTP status codes to consistent code strings.',
        'claude'
    ))
    story.append(make_step(
        33,
        'Infrastructure and deployment hardening',
        'New .dockerignore reduces Docker build context. Dockerfile uses multi-stage build with Alpine Node 20 '
        'and runs as non-root user. CI pipeline now includes security audit (pnpm audit) and Hardhat contract '
        'tests as separate jobs. CI audit level set to critical (Next.js 14 has a known high-severity advisory '
        'GHSA-h25m-26qc-wcjf requiring upgrade to Next.js 15+; app is not affected since it uses zero server '
        'actions). pnpm overrides patch transitive vulnerabilities in glob (>=10.5.0) and axios (>=1.13.5). '
        'Server bootstrap validates required env vars on startup, registers crash '
        'handlers, runs database health checks, and implements graceful SIGINT/SIGTERM shutdown with '
        '10-second timeout. Stale game sessions are marked abandoned on restart.',
        'claude'
    ))
    story.append(make_step(
        34,
        'Comprehensive test suite',
        '235+ test cases across 19 test files covering: WebSocket protocol (30+ cases), auth routes (16), '
        'wallet routes (16), analytics (6), collaborators (7), play-session (6), games/marketplace/'
        'tournaments (32), social routes (12), user routes (3), CSRF (8), sanitization (15), '
        'schemas (18), validation (7), integration (1), ArenaClient SDK (13), MoltbloxClient SDK (13), '
        'GamePublishingService (9), and PurchaseService (10). '
        'Run with: pnpm test (from repo root).',
        'claude'
    ))

    # ---- Section G: Enable CI/CD ----
    story.append(PageBreak())
    story.append(Paragraph('G. ENABLE CI/CD', section_style))
    story.append(Paragraph(
        'Turn on automated deployments so every push to main deploys automatically.',
        step_body_style
    ))
    story.append(Spacer(1, 6))

    story.append(make_step(
        35,
        'Add GitHub secrets',
        'In the repo settings (Settings > Secrets > Actions), add: '
        'VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.',
        'you'
    ))
    story.append(make_step(
        36,
        'Uncomment deploy jobs in CI',
        'Uncomment the deploy-web and deploy-server jobs in .github/workflows/ci.yml. '
        'Push the change to main.',
        'claude',
        '.github/workflows/ci.yml lines ~103-146'
    ))
    story.append(make_step(
        37,
        'Verify auto-deploy',
        'Make a small change, push to main, and confirm the CI pipeline builds, tests, '
        'and deploys to Vercel automatically.',
        'claude'
    ))

    # ---- Env var reference table ----
    story.append(PageBreak())
    story.append(Paragraph('ENVIRONMENT VARIABLE REFERENCE', section_style))
    story.append(Paragraph(
        'Complete list of all environment variables needed across all services.',
        step_body_style
    ))
    story.append(Spacer(1, 10))

    env_header = ['Variable', 'Where', 'Value']
    env_data = [
        env_header,
        ['DATABASE_URL', 'Server', 'postgresql://user:pass@host:5432/moltblox'],
        ['REDIS_URL', 'Server', 'redis://host:6379'],
        ['JWT_SECRET', 'Server', '<64 random characters>'],
        ['NODE_ENV', 'Server', 'production'],
        ['PORT', 'Server', '3001'],
        ['CORS_ORIGIN', 'Server', 'https://<vercel-url>'],
        ['BASE_RPC_URL', 'Server', 'https://sepolia.base.org'],
        ['MOLTBUCKS_ADDRESS', 'Server + Web', '<from contract deployment>'],
        ['GAME_MARKETPLACE_ADDRESS', 'Server + Web', '<from contract deployment>'],
        ['TOURNAMENT_MANAGER_ADDRESS', 'Server + Web', '<from contract deployment>'],
        ['SENTRY_DSN', 'Server', '<from sentry.io>'],
        ['MOLTBOOK_API_URL', 'Server', 'https://www.moltbook.com/api/v1'],
        ['MOLTBOOK_APP_KEY', 'Server', '<from moltbook dashboard>'],
        ['NEXT_PUBLIC_API_URL', 'Web (Vercel)', 'https://<server-url>/api/v1'],
        ['NEXT_PUBLIC_WS_URL', 'Web (Vercel)', 'wss://<server-url>'],
        ['NEXT_PUBLIC_WC_PROJECT_ID', 'Web (Vercel)', '<from walletconnect>'],
        ['NEXT_PUBLIC_CHAIN_ID', 'Web (Vercel)', '84532 (testnet) | 8453 (mainnet)'],
        ['NEXT_PUBLIC_SENTRY_DSN', 'Web (Vercel)', '<from sentry.io>'],
        ['DEPLOYER_PRIVATE_KEY', 'Contracts', '<wallet private key, no 0x>'],
        ['TREASURY_ADDRESS', 'Contracts', '<treasury wallet address>'],
        ['BASESCAN_API_KEY', 'Contracts', '<from basescan.org>'],
        ['VERCEL_TOKEN', 'GitHub Secrets', '<from vercel dashboard>'],
        ['VERCEL_ORG_ID', 'GitHub Secrets', '<from vercel dashboard>'],
        ['VERCEL_PROJECT_ID', 'GitHub Secrets', '<from vercel dashboard>'],
    ]

    # Style the env var names
    styled_env = []
    for i, row in enumerate(env_data):
        if i == 0:
            styled_env.append([
                Paragraph(f'<b>{c}</b>', ParagraphStyle('H', fontName='Helvetica-Bold', fontSize=8, textColor=WHITE))
                for c in row
            ])
        else:
            styled_env.append([
                Paragraph(f'<font face="Courier" color="#00D9A6" size="7">{row[0]}</font>', code_style),
                Paragraph(row[1], ParagraphStyle('V', fontName='Helvetica', fontSize=8, textColor=GREY)),
                Paragraph(row[2], ParagraphStyle('V', fontName='Helvetica', fontSize=7, textColor=LIGHT_GREY)),
            ])

    env_table = Table(styled_env, colWidths=[2.4 * inch, 1.1 * inch, 3.1 * inch])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SECTION_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), 1, TEAL_DIM),
    ]))
    story.append(env_table)

    # ---- Build ----
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print('Generated: MOLTBLOX_TESTNET_LAUNCH.pdf')


if __name__ == '__main__':
    build()
