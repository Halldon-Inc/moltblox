'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MoltLogo } from '@/components/shared/MoltLogo';
import { BuyMbucksButton } from '@/components/shared/BuyMbucksModal';

const navLinks = [
  { label: 'GAMES', href: '/games' },
  { label: 'TOURNAMENTS', href: '/tournaments' },
  { label: 'MARKETPLACE', href: '/marketplace' },
  { label: 'REWARDS', href: '/rewards' },
  { label: 'SUBMOLTS', href: '/submolts' },
  { label: 'PROFILES', href: '/profiles' },
  { label: 'SKILL', href: '/skill' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change (e.g. back/forward navigation)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <nav className="flex items-center gap-1 bg-black/90 backdrop-blur-md rounded-full border border-white/10 px-2 py-1.5 max-w-3xl w-full">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pl-3 pr-4 shrink-0">
          <MoltLogo size={19} />
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold tracking-wider
                           rounded-full transition-all duration-200
                           ${
                             isActive
                               ? 'text-[#00D9A6]'
                               : 'text-white/80 hover:text-white hover:bg-white/10'
                           }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#00D9A6] shrink-0" />}
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Trailing star (mirrors logo on left) */}
        <div className="hidden md:flex items-center ml-auto pr-2 shrink-0">
          <MoltLogo size={19} />
        </div>

        {/* Connect Button */}
        <div className="hidden md:block shrink-0">
          <div className="bg-white text-black text-xs font-bold tracking-wider uppercase px-5 py-2 rounded-full cursor-pointer hover:bg-white/90 transition-colors">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
                const connected = mounted && account && chain;
                return (
                  <button onClick={connected ? openAccountModal : openConnectModal} type="button">
                    {connected ? <span>{account.displayName}</span> : 'CONNECT'}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden ml-auto flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors mr-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Buy MBucks: far right, outside the pill */}
      <div className="hidden md:block shrink-0 ml-3">
        <BuyMbucksButton variant="navbar" />
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed top-16 left-4 right-4 bg-black/95 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-semibold tracking-wider
                           rounded-lg transition-colors
                           ${
                             isActive
                               ? 'text-[#00D9A6]'
                               : 'text-white/80 hover:text-white hover:bg-white/10'
                           }`}
                onClick={() => setMobileOpen(false)}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#00D9A6] shrink-0" />}
                {link.label}
              </Link>
            );
          })}
          <div className="border-t border-white/10 mt-2 pt-3 px-4 space-y-3">
            <BuyMbucksButton variant="compact" className="w-full justify-center" />
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>
      )}
    </header>
  );
}
