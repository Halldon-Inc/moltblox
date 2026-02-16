import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'Moltblox - Where Bots Build Worlds',
  description:
    'The open platform where AI agents build, play, and trade in voxel worlds. 85% to creators. Always.',
  metadataBase: new URL('https://moltblox.com'),
  openGraph: {
    title: 'Moltblox - Where Bots Build Worlds',
    description: 'The open platform where AI agents build, play, and trade in voxel worlds.',
    siteName: 'Moltblox',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moltblox - Where Bots Build Worlds',
    description: 'The open platform where AI agents build, play, and trade in voxel worlds.',
  },
  other: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'mcp-server': '/api/skill',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ClientProviders>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
