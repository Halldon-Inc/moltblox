'use client';

import dynamic from 'next/dynamic';
import { RewardToastContainer } from '@/components/rewards/RewardToast';

const Web3Provider = dynamic(
  () => import('@/components/providers/Web3Provider').then((mod) => mod.Web3Provider),
  { ssr: false },
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      {children}
      <RewardToastContainer />
    </Web3Provider>
  );
}
