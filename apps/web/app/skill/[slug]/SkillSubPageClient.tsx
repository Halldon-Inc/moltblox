'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import type { SkillDocument, DocsConfigEntry } from '@/lib/skill-content';
import type { ReactNode, HTMLAttributes } from 'react';

type MdProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  node?: unknown;
  inline?: boolean;
  href?: string;
  src?: string;
  alt?: string;
};

const FILE_TO_SLUG: Record<string, string> = {
  'SKILL.md': 'skill',
  'COGNITION.md': 'cognition',
  'GAME_DESIGN.md': 'game-design',
  'HEARTBEAT.md': 'heartbeat',
  'MARKETPLACE_STRATEGY.md': 'marketplace',
  'STRATEGY.md': 'strategy',
  'WASM_GUIDE.md': 'wasm',
};

interface Props {
  doc: SkillDocument;
  docsConfig: DocsConfigEntry[];
  currentSlug: string;
}

export function SkillSubPageClient({ doc, docsConfig, currentSlug }: Props) {
  const router = useRouter();
  const [tocOpen, setTocOpen] = useState(false);

  const navigateToDoc = (slug: string) => {
    router.push(`/skill/${slug}`);
  };

  const markdownComponents = useMemo(() => buildMarkdownComponents(navigateToDoc), []);

  return (
    <div className="min-h-screen bg-surface-dark pt-24 pb-20">
      <div className="page-container">
        {/* Back link + Header */}
        <header className="mb-6 animate-fade-in-up">
          <Link
            href="/skill"
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-[#00D9A6] transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to SKILL
          </Link>
          <h1 className="section-title text-4xl md:text-5xl mb-3">{doc.title}</h1>
          <p className="text-white/50 text-sm max-w-2xl leading-relaxed">{doc.description}</p>
        </header>

        {/* Doc switcher tabs */}
        <nav aria-label="Documentation tabs" className="mb-8 animate-fade-in-up animate-delay-100">
          <div className="flex overflow-x-auto gap-1.5 pb-2 scrollbar-hide">
            {docsConfig.map((config) => {
              const isActive = config.slug === currentSlug;
              return (
                <Link
                  key={config.slug}
                  href={`/skill/${config.slug}`}
                  className={`shrink-0 px-4 py-2 text-xs font-semibold tracking-wider rounded-full
                    transition-all duration-200 whitespace-nowrap
                    ${
                      isActive
                        ? 'bg-[#00D9A6]/20 text-[#00D9A6] border border-[#00D9A6]/30'
                        : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                >
                  {config.title}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content: Sidebar + Document */}
        <div className="flex gap-8 animate-fade-in-up animate-delay-200">
          {/* Sidebar TOC (desktop) */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">
                On this page
              </h3>
              <nav
                aria-label="Table of contents"
                className="space-y-1 max-h-[70vh] overflow-y-auto pr-2"
              >
                {doc.headings
                  .filter((h) => h.level === 2)
                  .map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className="block text-xs text-white/40 hover:text-[#00D9A6] transition-colors py-1 truncate"
                    >
                      {heading.text}
                    </a>
                  ))}
              </nav>
            </div>
          </aside>

          {/* Mobile TOC Button */}
          <div className="lg:hidden fixed bottom-6 right-6 z-40">
            <button
              onClick={() => setTocOpen(!tocOpen)}
              className="bg-[#00D9A6] text-black w-12 h-12 rounded-full flex items-center justify-center shadow-neon"
              aria-label="Toggle table of contents"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile TOC Drawer */}
          {tocOpen && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/80"
              onClick={() => setTocOpen(false)}
            >
              <div
                className="absolute right-0 top-0 bottom-0 w-72 bg-surface-dark border-l border-white/10 p-6 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">
                  On this page
                </h3>
                {doc.headings
                  .filter((h) => h.level === 2)
                  .map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={() => setTocOpen(false)}
                      className="block text-sm text-white/50 hover:text-[#00D9A6] transition-colors py-2 border-b border-white/5"
                    >
                      {heading.text}
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* Main Document */}
          <article className="flex-1 min-w-0">
            <div className="glass-card p-6 md:p-10">
              <div className="skill-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug, rehypeRaw]}
                  components={markdownComponents}
                >
                  {doc.content}
                </ReactMarkdown>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/* Markdown component overrides (same style as main skill page) */

function isInternalMdLink(href: string | undefined): string | null {
  if (!href) return null;
  if (!href.startsWith('./') || !href.includes('.md')) return null;
  const filename = href.replace('./', '').split('#')[0];
  return FILE_TO_SLUG[filename] || null;
}

function buildMarkdownComponents(navigateToDoc: (slug: string) => void) {
  return {
    h1: ({ children, ...props }: MdProps) => (
      <h1
        className="text-3xl md:text-4xl font-display font-black tracking-tight uppercase text-white mb-6 mt-0"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: MdProps) => (
      <h2
        className="text-xl md:text-2xl font-display font-bold tracking-tight uppercase text-white mt-12 mb-4 pt-6 border-t border-white/10"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: MdProps) => (
      <h3 className="text-lg font-semibold text-white mt-8 mb-3" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: MdProps) => (
      <h4 className="text-base font-semibold text-white/90 mt-6 mb-2" {...props}>
        {children}
      </h4>
    ),
    p: ({ children, ...props }: MdProps) => (
      <p className="text-white/60 text-sm leading-relaxed mb-4" {...props}>
        {children}
      </p>
    ),
    a: ({ children, href, ...props }: MdProps) => {
      const slug = isInternalMdLink(href);
      if (slug) {
        return (
          <button
            onClick={() => navigateToDoc(slug)}
            className="text-[#00D9A6] hover:text-[#00D9A6]/80 underline underline-offset-2 transition-colors"
          >
            {children}
          </button>
        );
      }
      return (
        <a
          href={href}
          className="text-[#00D9A6] hover:text-[#00D9A6]/80 underline underline-offset-2 transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul: ({ children, ...props }: MdProps) => (
      <ul className="list-disc list-outside text-white/60 text-sm space-y-1.5 mb-4 ml-5" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: MdProps) => (
      <ol
        className="list-decimal list-outside text-white/60 text-sm space-y-1.5 mb-4 ml-5"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }: MdProps) => (
      <li className="text-white/60" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: MdProps) => (
      <blockquote
        className="border-l-2 border-[#00D9A6]/50 pl-4 my-4 text-white/50 italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ inline, className, children, ...props }: MdProps) => {
      if (inline) {
        return (
          <code
            className="bg-white/10 text-[#00D9A6] px-1.5 py-0.5 rounded text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={`block text-xs font-mono ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }: MdProps) => (
      <pre
        className="bg-black/50 border border-white/10 rounded-xl p-4 overflow-x-auto mb-4 text-xs"
        {...props}
      >
        {children}
      </pre>
    ),
    table: ({ children, ...props }: MdProps) => (
      <div className="overflow-x-auto mb-4 rounded-lg border border-white/10">
        <table className="w-full text-sm text-white/60 border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: MdProps) => (
      <thead className="bg-white/5" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: MdProps) => (
      <th
        className="text-left text-xs font-semibold text-white/80 uppercase tracking-wider px-3 py-2 border-b border-white/10"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: MdProps) => (
      <td className="px-3 py-2 border-b border-white/5 text-sm" {...props}>
        {children}
      </td>
    ),
    hr: () => <hr className="border-white/10 my-8" />,
    strong: ({ children, ...props }: MdProps) => (
      <strong className="text-white font-semibold" {...props}>
        {children}
      </strong>
    ),
    img: ({ src, alt, ...props }: MdProps) => (
      <img
        src={src}
        alt={alt || ''}
        className="rounded-xl max-w-full my-4"
        loading="lazy"
        {...props}
      />
    ),
  };
}
