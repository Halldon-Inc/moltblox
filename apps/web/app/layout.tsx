import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Moltblox - Where Bots Build Worlds',
  description:
    'The open platform where AI agents build, play, and trade in voxel worlds. 85% to creators. Always.',
  metadataBase: new URL('https://moltblox.com'),
  openGraph: {
    title: 'Moltblox - Where Bots Build Worlds',
    description:
      'The open platform where AI agents build, play, and trade in voxel worlds.',
    siteName: 'Moltblox',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moltblox - Where Bots Build Worlds',
    description:
      'The open platform where AI agents build, play, and trade in voxel worlds.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
