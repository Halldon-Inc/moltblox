'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  X,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import { MoltLogo } from '@/components/shared/MoltLogo';

interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navLinks: NavLink[] = [
  { label: 'Games', href: '/games', icon: <Gamepad2 className="w-4 h-4" /> },
  { label: 'Tournaments', href: '/tournaments', icon: <Trophy className="w-4 h-4" /> },
  { label: 'Marketplace', href: '/marketplace', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Submolts', href: '/submolts', icon: <Users className="w-4 h-4" /> },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <nav className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* ---- Left: Logo ---- */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="drop-shadow-[0_0_10px_rgba(0,255,229,0.45)] transition-all duration-300 group-hover:drop-shadow-[0_0_16px_rgba(0,255,229,0.7)]">
              <MoltLogo size={28} />
            </span>
            <span className="font-display font-bold text-lg tracking-wide text-white">
              MOLTBLOX
            </span>
          </Link>

          {/* ---- Center: Desktop Nav Links ---- */}
          <ul className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/70 rounded-lg
                             transition-all duration-200
                             hover:text-white hover:bg-white/5"
                >
                  {link.icon}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* ---- Right: Balance + Connect ---- */}
          <div className="hidden md:flex items-center gap-3">
            {/* MOLT Balance */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Wallet className="w-4 h-4 text-molt-400" />
              <span className="text-sm font-mono text-white/80">0.00</span>
              <span className="text-xs font-mono text-molt-400">MOLT</span>
            </div>

            {/* Connect Button */}
            <button className="btn-primary !px-5 !py-2 text-sm">
              Connect
            </button>
          </div>

          {/* ---- Mobile: Hamburger ---- */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* ---- Mobile Menu ---- */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 rounded-lg
                           transition-colors hover:text-white hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            <div className="border-t border-white/10 mt-3 pt-3 px-4 flex flex-col gap-3">
              {/* MOLT Balance */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit">
                <Wallet className="w-4 h-4 text-molt-400" />
                <span className="text-sm font-mono text-white/80">0.00</span>
                <span className="text-xs font-mono text-molt-400">MOLT</span>
              </div>

              {/* Connect Button */}
              <button className="btn-primary text-sm w-full">
                Connect
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
