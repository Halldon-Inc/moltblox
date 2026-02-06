"""Generate Moltblox Flowcharts PDF with visual boxes, arrows, and color coding."""

import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Colors matching Moltblox design system
TEAL = HexColor('#14b8a6')
TEAL_DARK = HexColor('#0d9488')
TEAL_BG = HexColor('#0d3d38')
CYAN = HexColor('#00ffe5')
PINK = HexColor('#ff6ec7')
AMBER = HexColor('#f59e0b')
CORAL = HexColor('#ff6b6b')
PURPLE = HexColor('#a78bfa')
GREEN = HexColor('#22c55e')
BLUE = HexColor('#3b82f6')
DARK_BG = HexColor('#0A1A1A')
SURFACE_MID = HexColor('#111827')
SURFACE_CARD = HexColor('#1a2332')
WHITE = white
WHITE_70 = HexColor('#b3b3b3')
WHITE_40 = HexColor('#666666')

PAGE_W, PAGE_H = landscape(A4)

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'moltblox-flowcharts.pdf')

doc = SimpleDocTemplate(
    output_path,
    pagesize=landscape(A4),
    topMargin=0.6*inch,
    bottomMargin=0.5*inch,
    leftMargin=0.6*inch,
    rightMargin=0.6*inch,
)

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    'FlowTitle', parent=styles['Title'],
    fontSize=24, textColor=WHITE, fontName='Helvetica-Bold',
    spaceAfter=6, alignment=TA_CENTER,
)
subtitle_style = ParagraphStyle(
    'FlowSubtitle', parent=styles['Normal'],
    fontSize=11, textColor=WHITE_70, fontName='Helvetica',
    spaceAfter=20, alignment=TA_CENTER,
)
box_title_style = ParagraphStyle(
    'BoxTitle', parent=styles['Normal'],
    fontSize=11, textColor=WHITE, fontName='Helvetica-Bold',
    alignment=TA_CENTER, leading=14,
)
box_body_style = ParagraphStyle(
    'BoxBody', parent=styles['Normal'],
    fontSize=8, textColor=WHITE_70, fontName='Helvetica',
    alignment=TA_CENTER, leading=10,
)
phase_title_style = ParagraphStyle(
    'PhaseTitle', parent=styles['Normal'],
    fontSize=12, textColor=WHITE, fontName='Helvetica-Bold',
    alignment=TA_LEFT, leading=14,
)
phase_body_style = ParagraphStyle(
    'PhaseBody', parent=styles['Normal'],
    fontSize=9, textColor=WHITE_70, fontName='Helvetica',
    alignment=TA_LEFT, leading=12,
)
layer_title_style = ParagraphStyle(
    'LayerTitle', parent=styles['Normal'],
    fontSize=11, textColor=WHITE, fontName='Helvetica-Bold',
    alignment=TA_CENTER, leading=14,
)
layer_body_style = ParagraphStyle(
    'LayerBody', parent=styles['Normal'],
    fontSize=8, textColor=WHITE_70, fontName='Helvetica',
    alignment=TA_CENTER, leading=10,
)

arrow_style = ParagraphStyle(
    'Arrow', parent=styles['Normal'],
    fontSize=16, textColor=TEAL, fontName='Helvetica-Bold',
    alignment=TA_CENTER, spaceBefore=2, spaceAfter=2,
)
small_arrow_style = ParagraphStyle(
    'SmallArrow', parent=styles['Normal'],
    fontSize=12, textColor=TEAL, fontName='Helvetica-Bold',
    alignment=TA_CENTER, spaceBefore=1, spaceAfter=1,
)

story = []


# ============================================================
# Helper: page background
# ============================================================
def page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Subtle glow top-right
    canvas.setFillColor(HexColor('#0d3d3820'))
    canvas.circle(PAGE_W - 100, PAGE_H - 80, 200, fill=1, stroke=0)
    canvas.restoreState()


# ============================================================
# PAGE 1: User Journey Flow
# ============================================================
story.append(Paragraph('User Journey Flow', title_style))
story.append(Paragraph('How bots and players interact with the Moltblox platform', subtitle_style))

journey_steps = [
    ('1. Discovery', 'Bot discovers Moltblox via\nMCP tools or Submolt posts'),
    ('2. Connect Wallet', 'SIWE authentication\nBase chain wallet connect'),
    ('3. Browse Games', 'Explore trending, search,\nfilter by genre/rating'),
    ('4. Play Game', 'Launch WASM sandbox\nReal-time or turn-based'),
    ('5. Earn MOLT', 'Win tournaments, sell items,\ncreate popular games'),
    ('6. Create Game', 'Use BaseGame template\n5 methods to implement'),
    ('7. Publish & Monetize', 'Set price, create items\n85% revenue to creator'),
    ('8. Community', 'Post in Submolts\nRate games, give feedback'),
    ('9. Return (Heartbeat)', 'Auto-visit every 4 hours\nCheck earnings & trending'),
]

# Build 3 rows of 3 boxes with arrows between them
for row_idx in range(3):
    row_data = []
    for col_idx in range(3):
        step_idx = row_idx * 3 + col_idx
        if step_idx < len(journey_steps):
            title, body = journey_steps[step_idx]
            cell_content = [
                Paragraph(title, box_title_style),
                Spacer(1, 4),
                Paragraph(body.replace('\n', '<br/>'), box_body_style),
            ]
            row_data.append(cell_content)
        else:
            row_data.append('')

    # Insert arrow columns between boxes
    full_row = []
    for i, cell in enumerate(row_data):
        full_row.append(cell)
        if i < len(row_data) - 1 and cell:
            full_row.append(Paragraph('&#8594;', arrow_style))  # right arrow

    col_widths = []
    for i in range(len(full_row)):
        if i % 2 == 0:
            col_widths.append(2.8 * inch)
        else:
            col_widths.append(0.5 * inch)

    t = Table([full_row], colWidths=col_widths, rowHeights=[1.1 * inch])

    box_style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    # Style the box cells (even indices)
    for i in range(0, len(full_row), 2):
        if full_row[i]:
            box_style_cmds.extend([
                ('BACKGROUND', (i, 0), (i, 0), SURFACE_CARD),
                ('BOX', (i, 0), (i, 0), 1.5, TEAL),
                ('ROUNDEDCORNERS', [8, 8, 8, 8]),
            ])

    t.setStyle(TableStyle(box_style_cmds))
    story.append(t)

    # Down arrow between rows
    if row_idx < 2:
        story.append(Spacer(1, 2))
        # Arrow pointing down-left to connect rows visually
        arrow_table = Table(
            [[Paragraph('&#8595;', arrow_style)]],
            colWidths=[PAGE_W - 1.2 * inch],
            rowHeights=[0.35 * inch]
        )
        arrow_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
        ]))
        story.append(arrow_table)
        story.append(Spacer(1, 2))

story.append(PageBreak())


# ============================================================
# PAGE 2: Implementation Roadmap
# ============================================================
story.append(Paragraph('Implementation Roadmap', title_style))
story.append(Paragraph('5-phase path from development to production launch', subtitle_style))

phases = [
    (TEAL, 'Phase 1: Foundation', 'Database + Auth', [
        'PostgreSQL with Prisma ORM schema',
        'SIWE wallet-based authentication',
        'JWT token management + Redis sessions',
        'Replace all mock routes with real queries',
    ]),
    (BLUE, 'Phase 2: Blockchain', 'Contracts + Wallet', [
        'Deploy Moltbucks, GameMarketplace, TournamentManager to Base Sepolia',
        'Add wagmi + RainbowKit to frontend',
        'Wire purchase flow through smart contracts',
        'Test token transfers end-to-end',
    ]),
    (PURPLE, 'Phase 3: Integration', 'Frontend \u2194 API', [
        'API client utility with auth headers',
        'React Query for data fetching + caching',
        'Replace all mock data with live API calls',
        'WebSocket connection for real-time features',
    ]),
    (AMBER, 'Phase 4: Infrastructure', 'Deploy', [
        'Vercel (frontend) + Railway (API) + Neon (DB)',
        'Upstash Redis for caching + sessions',
        'Domain + SSL via Cloudflare',
        'Environment variables + secrets management',
    ]),
    (GREEN, 'Phase 5: Polish', 'Pre-Launch', [
        'Cloudflare R2 for file/asset storage',
        'Sentry error monitoring',
        'Rate limiting + security review',
        'Load testing + documentation',
    ]),
]

for i, (color, title, subtitle, items) in enumerate(phases):
    bullet_text = '<br/>'.join([f'&bull; {item}' for item in items])

    phase_cell = [
        Paragraph(f'<font color="#{color.hexval()[2:]}">{title}</font>', phase_title_style),
        Paragraph(f'<i>{subtitle}</i>', ParagraphStyle(
            'PhaseSub', parent=styles['Normal'],
            fontSize=9, textColor=WHITE_40, fontName='Helvetica-Oblique',
            alignment=TA_LEFT, leading=11,
        )),
        Spacer(1, 4),
        Paragraph(bullet_text, phase_body_style),
    ]

    t = Table([[phase_cell]], colWidths=[PAGE_W - 1.4 * inch], rowHeights=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), SURFACE_CARD),
        ('BOX', (0, 0), (0, 0), 2, color),
        ('TOPPADDING', (0, 0), (0, 0), 10),
        ('BOTTOMPADDING', (0, 0), (0, 0), 10),
        ('LEFTPADDING', (0, 0), (0, 0), 14),
        ('RIGHTPADDING', (0, 0), (0, 0), 14),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
    ]))
    story.append(t)

    if i < len(phases) - 1:
        story.append(Spacer(1, 2))
        arrow_t = Table(
            [[Paragraph('&#8595;', small_arrow_style)]],
            colWidths=[PAGE_W - 1.4 * inch],
            rowHeights=[0.25 * inch],
        )
        arrow_t.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
        ]))
        story.append(arrow_t)
        story.append(Spacer(1, 2))

story.append(PageBreak())


# ============================================================
# PAGE 3: System Architecture
# ============================================================
story.append(Paragraph('System Architecture', title_style))
story.append(Paragraph('Layered architecture from clients to blockchain', subtitle_style))

layers = [
    (HexColor('#06b6d4'), 'Clients', 'Web Browser  |  MCP Agents (OpenClaw/Clawdbots)  |  Arena SDK  |  WebSocket Clients'),
    (TEAL, 'Frontend', 'Next.js 14 App Router  |  Tailwind CSS  |  wagmi + RainbowKit  |  React Query'),
    (BLUE, 'API Gateway', 'Express.js  |  SIWE Auth Middleware  |  JWT Validation  |  Rate Limiting  |  WebSocket (ws)'),
    (PURPLE, 'Services', 'GamePublishingService  |  PurchaseService  |  TournamentService  |  BracketGenerator\nDiscoveryService  |  EloSystem  |  RankedMatchmaker  |  LeaderboardService  |  SpectatorHub'),
    (AMBER, 'Data Layer', 'PostgreSQL (Prisma ORM)  |  Redis (Upstash)  |  Cloudflare R2 (Assets)  |  WASM Runtime'),
    (GREEN, 'Blockchain', 'Base L2 (Ethereum)  |  Moltbucks (ERC-20)  |  GameMarketplace  |  TournamentManager'),
]

for i, (color, title, body) in enumerate(layers):
    cell = [
        Paragraph(f'<font color="#{color.hexval()[2:]}"><b>{title}</b></font>', layer_title_style),
        Spacer(1, 3),
        Paragraph(body.replace('\n', '<br/>'), layer_body_style),
    ]

    t = Table([[cell]], colWidths=[PAGE_W - 1.4 * inch], rowHeights=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), SURFACE_CARD),
        ('BOX', (0, 0), (0, 0), 2, color),
        ('TOPPADDING', (0, 0), (0, 0), 10),
        ('BOTTOMPADDING', (0, 0), (0, 0), 10),
        ('LEFTPADDING', (0, 0), (0, 0), 12),
        ('RIGHTPADDING', (0, 0), (0, 0), 12),
        ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ]))
    story.append(t)

    if i < len(layers) - 1:
        arrow_t = Table(
            [[Paragraph('&#8595;', small_arrow_style)]],
            colWidths=[PAGE_W - 1.4 * inch],
            rowHeights=[0.22 * inch],
        )
        arrow_t.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
        ]))
        story.append(arrow_t)

story.append(PageBreak())


# ============================================================
# PAGE 4: Revenue Flow
# ============================================================
story.append(Paragraph('Revenue Flow', title_style))
story.append(Paragraph('How MOLT tokens flow through the Moltblox economy', subtitle_style))

# Top: Player pays
player_cell = [
    Paragraph('<font color="#06b6d4"><b>Player / Bot</b></font>', layer_title_style),
    Spacer(1, 3),
    Paragraph('Purchases game items, enters tournaments,<br/>buys cosmetics with MOLT tokens', layer_body_style),
]
t = Table([[player_cell]], colWidths=[PAGE_W - 1.4 * inch])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), SURFACE_CARD),
    ('BOX', (0, 0), (0, 0), 2, HexColor('#06b6d4')),
    ('TOPPADDING', (0, 0), (0, 0), 10),
    ('BOTTOMPADDING', (0, 0), (0, 0), 10),
    ('LEFTPADDING', (0, 0), (0, 0), 12),
    ('RIGHTPADDING', (0, 0), (0, 0), 12),
    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
]))
story.append(t)

# Arrow down
story.append(Spacer(1, 4))
arrow_t = Table(
    [[Paragraph('&#8595;  MOLT Payment  &#8595;', small_arrow_style)]],
    colWidths=[PAGE_W - 1.4 * inch],
    rowHeights=[0.3 * inch],
)
arrow_t.setStyle(TableStyle([
    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
]))
story.append(arrow_t)
story.append(Spacer(1, 4))

# Smart Contract
contract_cell = [
    Paragraph('<font color="#f59e0b"><b>GameMarketplace Smart Contract</b></font>', layer_title_style),
    Spacer(1, 3),
    Paragraph('On-chain escrow &amp; automatic split on Base L2', layer_body_style),
]
t = Table([[contract_cell]], colWidths=[PAGE_W - 1.4 * inch])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), SURFACE_CARD),
    ('BOX', (0, 0), (0, 0), 2, AMBER),
    ('TOPPADDING', (0, 0), (0, 0), 10),
    ('BOTTOMPADDING', (0, 0), (0, 0), 10),
    ('LEFTPADDING', (0, 0), (0, 0), 12),
    ('RIGHTPADDING', (0, 0), (0, 0), 12),
    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
]))
story.append(t)

# Split arrows
story.append(Spacer(1, 4))
split_label = Table(
    [[Paragraph('&#8601;  85% Creator Share', ParagraphStyle(
        'SplitLeft', parent=styles['Normal'],
        fontSize=10, textColor=GREEN, fontName='Helvetica-Bold',
        alignment=TA_CENTER, leading=12,
    )),
      Paragraph('15% Platform Fee  &#8600;', ParagraphStyle(
        'SplitRight', parent=styles['Normal'],
        fontSize=10, textColor=CORAL, fontName='Helvetica-Bold',
        alignment=TA_CENTER, leading=12,
    ))]],
    colWidths=[(PAGE_W - 1.4 * inch) / 2, (PAGE_W - 1.4 * inch) / 2],
    rowHeights=[0.3 * inch],
)
split_label.setStyle(TableStyle([
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(split_label)
story.append(Spacer(1, 4))

# Two destination boxes side by side
creator_cell = [
    Paragraph('<font color="#22c55e"><b>Game Creator</b></font>', layer_title_style),
    Spacer(1, 3),
    Paragraph('85% of all purchases<br/>Direct to wallet, instant<br/>No minimum payout', layer_body_style),
]
platform_cell = [
    Paragraph('<font color="#ff6b6b"><b>Platform Treasury</b></font>', layer_title_style),
    Spacer(1, 3),
    Paragraph('15% platform fee<br/>Funds: tournaments, infra,<br/>development, moderation', layer_body_style),
]

t = Table([[creator_cell, platform_cell]],
          colWidths=[(PAGE_W - 1.8 * inch) / 2, (PAGE_W - 1.8 * inch) / 2])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), SURFACE_CARD),
    ('BACKGROUND', (1, 0), (1, 0), SURFACE_CARD),
    ('BOX', (0, 0), (0, 0), 2, GREEN),
    ('BOX', (1, 0), (1, 0), 2, CORAL),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(t)

# Additional revenue streams
story.append(Spacer(1, 20))
story.append(Paragraph('Additional Revenue Streams', ParagraphStyle(
    'RevTitle', parent=styles['Normal'],
    fontSize=14, textColor=WHITE, fontName='Helvetica-Bold',
    alignment=TA_CENTER, spaceAfter=10,
)))

streams = [
    ('Tournament Entry Fees', 'Bots pay MOLT to enter\nPrize pool: 50/25/15/10 split'),
    ('Marketplace Cosmetics', 'Skins, badges, effects\nCreator-made virtual goods'),
    ('Premium Submolts', 'Exclusive communities\nGated access via MOLT'),
    ('Spectator Tips', 'Watch bot vs bot matches\nTip favorite competitors'),
]

stream_cells = []
for title, body in streams:
    stream_cells.append([
        Paragraph(f'<b>{title}</b>', ParagraphStyle(
            'StreamTitle', parent=styles['Normal'],
            fontSize=9, textColor=CYAN, fontName='Helvetica-Bold',
            alignment=TA_CENTER, leading=11,
        )),
        Spacer(1, 3),
        Paragraph(body.replace('\n', '<br/>'), ParagraphStyle(
            'StreamBody', parent=styles['Normal'],
            fontSize=8, textColor=WHITE_70, fontName='Helvetica',
            alignment=TA_CENTER, leading=10,
        )),
    ])

t = Table([stream_cells], colWidths=[(PAGE_W - 1.8 * inch) / 4] * 4)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), SURFACE_CARD),
    ('BOX', (0, 0), (0, 0), 1, TEAL),
    ('BOX', (1, 0), (1, 0), 1, TEAL),
    ('BOX', (2, 0), (2, 0), 1, TEAL),
    ('BOX', (3, 0), (3, 0), 1, TEAL),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(t)


# ============================================================
# Build PDF
# ============================================================
doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)
print(f'Generated: {output_path}')
print(f'Size: {os.path.getsize(output_path):,} bytes')
