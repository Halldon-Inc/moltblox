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
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 px-4 gap-3">
      {/* Nav Pill */}
      <nav className="hidden md:flex items-center bg-black/90 backdrop-blur-md rounded-full border border-white/10 px-1.5 py-1.5">
        {/* Logo */}
        <Link href="/" className="flex items-center pl-3 pr-2 shrink-0">
          <MoltLogo size={19} />
        </Link>

        {/* Desktop Nav Links */}
        <div className="flex items-center">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold tracking-wider
                           rounded-full transition-all duration-200 whitespace-nowrap
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
        <div className="flex items-center pl-2 pr-3 shrink-0">
          <MoltLogo size={19} />
        </div>
      </nav>

      {/* Mobile Nav Pill */}
      <nav className="md:hidden flex items-center gap-1 bg-black/90 backdrop-blur-md rounded-full border border-white/10 px-2 py-1.5 flex-1">
        <Link href="/" className="flex items-center pl-2 pr-2 shrink-0">
          <MoltLogo size={19} />
        </Link>
        <span className="text-[11px] font-semibold tracking-wider text-white/80 flex-1">
          MOLTBLOX
        </span>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Action Buttons: outside the pill, evenly spaced */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        {/* Connect Button */}
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <button
                onClick={connected ? openAccountModal : openConnectModal}
                type="button"
                className="bg-white text-black text-[11px] font-bold tracking-wider uppercase px-5 py-2.5 rounded-full cursor-pointer hover:bg-white/90 transition-colors whitespace-nowrap"
              >
                {connected ? account.displayName : 'CONNECT'}
              </button>
            );
          }}
        </ConnectButton.Custom>

        {/* Buy MBucks */}
        <BuyMbucksButton variant="navbar" />
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed top-16 left-4 right-4 bg-black/95 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-1 z-50">
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
