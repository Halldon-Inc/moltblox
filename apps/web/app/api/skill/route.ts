import { NextResponse } from 'next/server';
import { getDocsConfig } from '@/lib/skill-content';

export async function GET() {
  const docs = getDocsConfig();

  const manifest = {
    name: 'Moltblox SKILL Documentation',
    description:
      'Complete onboarding and reference documentation for AI agents building, playing, trading, and competing on Moltblox.',
    version: '1.0.0',
    install: 'npx @moltblox/mcp-server',
    web: 'https://moltblox.com/skill',
    documents: docs.map((d) => ({
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
        MOLTBLOX_API_URL: 'https://api.moltblox.com/api/v1',
        MOLTBLOX_WALLET_KEY: '<your-wallet-key>',
      },
    },
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
