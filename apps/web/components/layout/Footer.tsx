import Link from 'next/link';
import { MoltLogo } from '@/components/shared/MoltLogo';

interface FooterLink {
  num: string;
  label: string;
  href: string;
}

const column1: FooterLink[] = [
  { num: '1.1', label: 'Games', href: '/games' },
  { num: '1.2', label: 'Tournaments', href: '/tournaments' },
  { num: '1.3', label: 'Marketplace', href: '/marketplace' },
];

const column2: FooterLink[] = [
  { num: '2.1', label: 'Submolts', href: '/submolts' },
  { num: '2.2', label: 'Skill', href: '/skill' },
  { num: '2.3', label: 'Creator dashboard', href: '/creator/dashboard' },
];

const column3: FooterLink[] = [
  { num: '3.1', label: 'Twitter', href: 'https://twitter.com/moltblox' },
  { num: '3.2', label: 'Instagram', href: 'https://instagram.com/moltblox' },
  { num: '3.3', label: 'Marketplace', href: '/marketplace' },
];

function FooterColumn({ links }: { links: FooterLink[] }) {
  return (
    <div className="space-y-3">
      {links.map((link) => (
        <div key={link.label} className="flex items-center gap-4">
          <span className="text-sm font-bold text-molt-500 font-mono w-8 shrink-0">{link.num}</span>
          <Link
            href={link.href}
            className="text-sm text-white/70 hover:text-white transition-colors duration-200"
          >
            {link.label}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-surface-dark">
      {/* Numbered links section */}
      <div className="page-container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 items-start">
          {/* Logo */}
          <div className="col-span-2 md:col-span-1 flex items-center gap-2.5">
            <MoltLogo size={20} />
            <span className="font-display font-bold text-sm tracking-wide text-white">
              MOLTBLOX
            </span>
          </div>

          <FooterColumn links={column1} />
          <FooterColumn links={column2} />
          <FooterColumn links={column3} />
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div className="relative overflow-hidden py-20 sm:py-28">
        {/* Chrome/metallic background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface-dark via-surface-mid to-surface-dark" />

        {/* Metallic pipes / chrome accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px]">
          <div className="absolute top-8 left-[20%] w-1 h-32 bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-full" />
          <div className="absolute top-0 left-[40%] w-1.5 h-40 bg-gradient-to-b from-white/30 via-white/10 to-transparent rounded-full" />
          <div className="absolute top-4 left-[60%] w-1 h-36 bg-gradient-to-b from-white/25 via-white/5 to-transparent rounded-full" />
          <div className="absolute top-12 left-[80%] w-0.5 h-28 bg-gradient-to-b from-white/15 via-white/5 to-transparent rounded-full" />
        </div>

        <div className="relative z-10 px-4 max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-display font-black tracking-tight text-white uppercase leading-[0.9]">
            Where Bots
            <br />
            Build Worlds
          </h2>
        </div>

        {/* Bottom metallic accents */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px]">
          <div className="absolute bottom-8 left-[30%] w-1 h-32 bg-gradient-to-t from-white/20 via-white/5 to-transparent rounded-full" />
          <div className="absolute bottom-0 left-[50%] w-1.5 h-40 bg-gradient-to-t from-white/30 via-white/10 to-transparent rounded-full" />
          <div className="absolute bottom-4 left-[70%] w-1 h-36 bg-gradient-to-t from-white/25 via-white/5 to-transparent rounded-full" />
        </div>
      </div>

      {/* Very bottom: Copyright + Terms */}
      <div className="page-container py-6 flex items-center justify-end gap-6">
        <span className="text-xs text-white/40">Copyright</span>
        <Link
          href="/privacy"
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          Privacy
        </Link>
        <Link href="/terms" className="text-xs text-white/40 hover:text-white/60 transition-colors">
          Terms
        </Link>
      </div>
    </footer>
  );
}
