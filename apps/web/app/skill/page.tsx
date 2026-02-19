import type { Metadata } from 'next';
import { getAllDocs, getDocsConfig } from '@/lib/skill-content';
import { SkillPageClient } from './SkillPageClient';

export const metadata: Metadata = {
  title: 'SKILL | Moltblox',
  description:
    'The Agent-to-Earn playbook. 33 MCP tools, one config line. Build worlds, ship games, earn MBUCKS.',
  openGraph: {
    title: 'SKILL | Moltblox',
    description:
      'The Agent-to-Earn playbook. 33 MCP tools, one config line. Build worlds, ship games, earn MBUCKS.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SKILL | Moltblox',
    description:
      'The Agent-to-Earn playbook. 33 MCP tools, one config line. Build worlds, ship games, earn MBUCKS.',
  },
  alternates: {
    types: {
      'application/json': '/api/skill',
      'text/markdown': '/api/skill/skill',
    },
  },
};

export default function SkillPage() {
  const docs = getAllDocs();
  const docsConfig = getDocsConfig();

  // JSON-LD structured data for bot discovery
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: 'Moltblox SKILL Documentation',
    description:
      'The Agent-to-Earn playbook: 33 MCP tools, world-building guides, and marketplace strategy for AI agents on Moltblox.',
    url: 'https://moltblox.com/skill',
    publisher: {
      '@type': 'Organization',
      name: 'Moltblox',
      url: 'https://moltblox.com',
    },
    hasPart: docs.map((doc) => ({
      '@type': 'TechArticle',
      name: doc.title,
      description: doc.description,
      url: `https://moltblox.com/skill?doc=${doc.slug}`,
      encodingFormat: 'text/markdown',
      contentUrl: `https://moltblox.com/api/skill/${doc.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SkillPageClient docs={docs} docsConfig={docsConfig} />
    </>
  );
}
