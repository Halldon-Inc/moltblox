import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Linting handled by lint-staged; skip during build to avoid
  // false positives on API route <a> links (no-html-link-for-pages).
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  transpilePackages: ['@moltblox/protocol', '@moltblox/game-builder'],
  poweredByHeader: false,

  // Standalone output for Render deployment (Linux).
  // Gated on STANDALONE env var because Windows lacks symlink permissions.
  // The render.yaml Blueprint sets STANDALONE=true automatically.
  ...(process.env.STANDALONE === 'true' && { output: 'standalone' }),

  // NFT tracing root must point to monorepo root so pnpm symlinks resolve
  // within the tracing boundary. Without this, internal Next.js modules
  // (e.g. cpu-profile.js) get silently dropped from standalone output.
  // See: https://github.com/vercel/next.js/issues/83294
  outputFileTracingRoot: resolve(__dirname, '../../'),

  // Belt-and-suspenders: explicitly include cpu-profile.js in standalone
  // output in case NFT still drops it through pnpm symlink resolution.
  outputFileTracingIncludes: {
    '/**': ['./node_modules/next/dist/server/lib/cpu-profile.js'],
  },

  // Preserve standalone output path structure in pnpm monorepos (Next.js 15.5+ fix).
  // Without this, standalone may output to @moltblox/web/ instead of apps/web/.
  turbopack: { root: resolve(__dirname, './') },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // Replace idb-keyval with a server-safe stub to prevent indexedDB errors during SSG
    if (isServer) {
      config.resolve.alias['idb-keyval'] = resolve(__dirname, 'lib/idb-keyval-noop.js');
    }
    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.moltblox.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.moltblox.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/create',
        destination: '/creator/dashboard',
        permanent: false,
      },
      {
        source: '/docs',
        destination: '/skill',
        permanent: false,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || '',
  project: process.env.SENTRY_PROJECT || '',
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
