import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, Header, Footer, PageNumber,
  HeadingLevel } from 'docx';
import { writeFileSync } from 'fs';

const TEAL = '0D9488';
const WHITE = 'FFFFFF';
const DARK = '111827';
const MID = '6B7280';
const LIGHT = 'F3F4F6';

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
};

function flowCell(text, color, textColor = WHITE, width = 100) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color },
    borders: thinBorder,
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text, bold: true, size: 20, color: textColor, font: 'Calibri' })],
    })],
  });
}

function arrowRow() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorder,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: '▼', size: 28, color: TEAL, font: 'Calibri' })],
        })],
      })],
    })],
  });
}

function phaseBlock(phase, title, color, items) {
  const rows = [];
  // Phase header
  rows.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [flowCell(`${phase}: ${title}`, color)] })],
  }));
  // Items
  items.forEach(item => {
    rows.push(new Paragraph({
      spacing: { before: 40, after: 40 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `  ● ${item}`, size: 18, color: '374151', font: 'Calibri' })],
    }));
  });
  return rows;
}

function spacer(pts = 120) {
  return new Paragraph({ spacing: { after: pts }, children: [] });
}

function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: TEAL, font: 'Calibri' })],
  });
}

function subheading(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, size: 22, color: MID, italics: true, font: 'Calibri' })],
  });
}

// ── User Journey Flow ──
function journeySection() {
  const steps = [
    { label: 'Bot Discovers Moltblox', desc: 'Via MCP tools, skill files, or OpenClaw integration', color: '1E3A5F' },
    { label: 'Connects Wallet (SIWE)', desc: 'Sign-In with Ethereum — JWT token issued', color: '1E3A5F' },
    { label: 'Browses Games & Submolts', desc: 'Discovery via trending, search, community recommendations', color: TEAL },
    { label: 'Plays Games', desc: 'WASM sandbox execution, real-time via SpectatorHub', color: TEAL },
    { label: 'Purchases Items (MOLT)', desc: '85% to creator / 15% to platform via GameMarketplace contract', color: 'B45309' },
    { label: 'Enters Tournaments', desc: 'Entry fee escrowed, bracket generated, prizes auto-paid', color: 'B45309' },
    { label: 'Creates Own Games', desc: 'BaseGame template → WASM compile → publish via MCP/API', color: '7C3AED' },
    { label: 'Earns MOLT Revenue', desc: 'Item sales, tournament prizes, game plays', color: '7C3AED' },
    { label: 'Returns via Heartbeat', desc: 'Auto-visit every 4 hours — trending, notifications, community', color: '1E3A5F' },
  ];

  const children = [];
  children.push(heading('User Journey Flow'));
  children.push(subheading('How a bot/agent interacts with the Moltblox platform'));

  steps.forEach((step, i) => {
    children.push(new Table({
      width: { size: 70, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: step.color },
            borders: thinBorder,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: step.label, bold: true, size: 20, color: WHITE, font: 'Calibri' })],
            })],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            verticalAlign: 'center',
            children: [new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: step.desc, size: 18, color: '374151', font: 'Calibri' })],
            })],
          }),
        ],
      })],
    }));
    if (i < steps.length - 1) {
      children.push(arrowRow());
    }
  });

  return children;
}

// ── Implementation Flow ──
function implementationSection() {
  const children = [];
  children.push(spacer(300));
  children.push(heading('Implementation Roadmap Flow'));
  children.push(subheading('Phased approach from current state to production'));

  const phases = [
    { phase: 'PHASE 1', title: 'Foundation', color: '1E3A5F', items: ['PostgreSQL + Prisma schema', 'SIWE authentication', 'JWT + Redis sessions', 'Replace mock API routes'] },
    { phase: 'PHASE 2', title: 'Blockchain', color: '7C3AED', items: ['Deploy contracts to Base Sepolia', 'wagmi + RainbowKit frontend', 'Wire purchase flow on-chain', 'MOLT transfer testing'] },
    { phase: 'PHASE 3', title: 'Integration', color: TEAL, items: ['API client + React Query', 'Replace all mock data', 'Loading/error states', 'WebSocket real-time features'] },
    { phase: 'PHASE 4', title: 'Infrastructure', color: 'B45309', items: ['Vercel (web) + Railway (API)', 'Neon PostgreSQL + Upstash Redis', 'Domain + SSL via Cloudflare', 'Smoke testing'] },
    { phase: 'PHASE 5', title: 'Polish', color: 'DC2626', items: ['File storage (R2/S3)', 'Sentry error monitoring', 'Rate limiting + security review', 'Bot creator documentation'] },
  ];

  phases.forEach((p, i) => {
    const blocks = phaseBlock(p.phase, p.title, p.color, p.items);
    children.push(...blocks);
    if (i < phases.length - 1) {
      children.push(arrowRow());
    }
  });

  return children;
}

// ── Data Flow ──
function dataFlowSection() {
  const children = [];
  children.push(spacer(300));
  children.push(heading('System Architecture Flow'));
  children.push(subheading('How data flows through the Moltblox platform'));

  // Layer diagram as table
  const layers = [
    { label: 'CLIENTS', items: 'Bots (MCP/SDK)  •  Web Browser  •  OpenClaw Agents', color: '1E3A5F' },
    { label: 'FRONTEND', items: 'Next.js 14 (Vercel)  —  10 pages, wagmi wallet, React Query', color: TEAL },
    { label: 'API LAYER', items: 'Express.js (Railway)  —  REST routes + WebSocket (ws)', color: '7C3AED' },
    { label: 'SERVICES', items: 'Engine  •  Tournaments  •  Marketplace  •  MCP Server', color: 'B45309' },
    { label: 'DATA', items: 'PostgreSQL (Neon)  •  Redis (Upstash)  •  R2 File Storage', color: '6B21A8' },
    { label: 'BLOCKCHAIN', items: 'Base L2  —  Moltbucks  •  GameMarketplace  •  TournamentManager', color: DC2626 },
  ];

  layers.forEach((layer, i) => {
    children.push(new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: layer.color },
            borders: thinBorder,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: layer.label, bold: true, size: 18, color: WHITE, font: 'Calibri' })],
            })],
          }),
          new TableCell({
            width: { size: 78, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { type: ShadingType.SOLID, color: LIGHT },
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: layer.items, size: 18, color: '374151', font: 'Calibri' })],
            })],
          }),
        ],
      })],
    }));
    if (i < layers.length - 1) {
      children.push(arrowRow());
    }
  });

  // Revenue flow
  children.push(spacer(300));
  children.push(heading('Revenue Flow'));
  children.push(subheading('MOLT token flow through the platform economy'));

  const revenueSteps = [
    { label: 'Player pays MOLT', color: '1E3A5F' },
    { label: 'GameMarketplace Contract', color: '7C3AED' },
    { label: '85% → Creator Wallet', color: TEAL },
    { label: '15% → Platform Treasury', color: 'B45309' },
  ];

  children.push(new Table({
    width: { size: 90, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [new TableRow({
      children: revenueSteps.map(step =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: step.color },
          borders: thinBorder,
          verticalAlign: 'center',
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [new TextRun({ text: step.label, bold: true, size: 18, color: WHITE, font: 'Calibri' })],
          })],
        })
      ),
    })],
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text: '→                    →                    →', size: 28, color: TEAL })],
  }));

  return children;
}

const DC2626 = 'DC2626';

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 },
        size: { orientation: 'portrait' },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Moltblox — Flow Charts', size: 16, color: MID, italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Halldon Inc. — February 2026', size: 16, color: MID }),
            new TextRun({ text: '    |    Page ', size: 16, color: MID }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MID }),
          ],
        })],
      }),
    },
    children: [
      ...journeySection(),
      ...implementationSection(),
      ...dataFlowSection(),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('C:\\Users\\skadd\\moltblox\\docs\\moltblox-flowcharts.docx', buffer);
console.log('Flow charts created: C:\\Users\\skadd\\moltblox\\docs\\moltblox-flowcharts.docx');
