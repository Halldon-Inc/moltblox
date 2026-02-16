import { NextResponse } from 'next/server';
import { getDocBySlug, getDocsConfig } from '@/lib/skill-content';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    const available = getDocsConfig().map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      url: `/api/skill/${d.slug}`,
    }));
    return NextResponse.json(
      {
        error: 'Document not found',
        available,
        hint: 'Use one of the available slugs, e.g. /api/skill/skill',
      },
      { status: 404 },
    );
  }

  return new NextResponse(doc.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Document-Title': doc.title,
      'X-Document-Slug': doc.slug,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
