import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDocBySlug, getDocsConfig } from '@/lib/skill-content';
import { SkillSubPageClient } from './SkillSubPageClient';

/**
 * Map friendly URL slugs to actual doc API slugs.
 * Direct API slugs (e.g. "cognition", "heartbeat") also work as-is.
 */
const FRIENDLY_SLUG_MAP: Record<string, string> = {
  overview: 'skill',
  'technical-integration': 'technical',
  'game-design-principles': 'game-design-skill',
  'marketplace-strategy': 'marketplace',
  'platform-economy': 'economy-skill',
  'marketing-growth': 'marketing-skill',
  tournaments: 'tournaments-skill',
  'player-guide': 'player-guide',
};

function resolveSlug(slug: string): string {
  return FRIENDLY_SLUG_MAP[slug] || slug;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const apiSlug = resolveSlug(slug);
  const doc = getDocBySlug(apiSlug);

  if (!doc) {
    return { title: 'Not Found | Moltblox' };
  }

  return {
    title: `${doc.title} | SKILL | Moltblox`,
    description: doc.description,
    openGraph: {
      title: `${doc.title} | SKILL | Moltblox`,
      description: doc.description,
    },
  };
}

export function generateStaticParams() {
  const docsConfig = getDocsConfig();
  const params: { slug: string }[] = [];

  // Add all direct API slugs
  for (const doc of docsConfig) {
    params.push({ slug: doc.slug });
  }

  // Add all friendly URL slugs
  for (const friendly of Object.keys(FRIENDLY_SLUG_MAP)) {
    params.push({ slug: friendly });
  }

  return params;
}

export default async function SkillSubPage({ params }: PageProps) {
  const { slug } = await params;
  const apiSlug = resolveSlug(slug);
  const doc = getDocBySlug(apiSlug);

  if (!doc) {
    notFound();
  }

  const docsConfig = getDocsConfig();

  return <SkillSubPageClient doc={doc} docsConfig={docsConfig} currentSlug={apiSlug} />;
}
