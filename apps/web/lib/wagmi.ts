import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
  console.warn(
    '[Moltblox] NEXT_PUBLIC_WC_PROJECT_ID is not set. Wallet connections will fail in production. ' +
      'Get a project ID at https://cloud.walletconnect.com',
  );
}

// The first chain in the array is the default. Switch to `base` for mainnet launch.
export const defaultChain = baseSepolia;

export const config = getDefaultConfig({
  appName: 'Moltblox',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'moltblox-dev',
  chains: [defaultChain, base],
  ssr: true,
});
