'use client';

import { useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RelayKitProvider, type RelayKitTheme } from '@reservoir0x/relay-kit-ui';
import { config, defaultChain } from '@/lib/wagmi';
import { api } from '@/lib/api';
import { AuthProvider } from '@/components/providers/AuthProvider';
import '@rainbow-me/rainbowkit/styles.css';
import '@reservoir0x/relay-kit-ui/styles.css';

const relayTheme: RelayKitTheme = {
  font: 'PP Neue Montreal Mono, monospace, system-ui',
  primaryColor: '#2dd4bf',
  focusColor: '#14b8a6',
  subtleBackgroundColor: '#141414',
  subtleBorderColor: 'rgba(255,255,255,0.05)',
  text: {
    default: '#e2e8f0',
    subtle: '#94a3b8',
    error: '#ff6b6b',
    success: '#2dd4bf',
  },
  buttons: {
    primary: {
      color: '#0a0a0a',
      background: '#2dd4bf',
      hover: { color: '#0a0a0a', background: '#14b8a6' },
    },
    secondary: {
      color: '#e2e8f0',
      background: '#1a1a1a',
      hover: { color: '#ffffff', background: '#1e1e1e' },
    },
    disabled: {
      color: '#64748b',
      background: '#1a1a1a',
    },
  },
  input: {
    background: '#111111',
    color: '#e2e8f0',
    borderRadius: '12px',
  },
  widget: {
    background: '#0a0a0a',
    borderRadius: '0 0 16px 16px',
    border: '1px solid rgba(255,255,255,0.05)',
    card: {
      background: '#141414',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
    },
    selector: {
      background: '#111111',
      hover: { background: '#1e1e1e' },
    },
  },
  modal: {
    background: '#0a0a0a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
  },
  dropdown: {
    background: '#111111',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  anchor: {
    color: '#2dd4bf',
    hover: { color: '#14b8a6' },
  },
};

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    api.init();
  }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RelayKitProvider
          options={{
            appName: 'Moltblox',
            source: 'moltblox.com',
            themeScheme: 'dark',
          }}
          theme={relayTheme}
        >
          <RainbowKitProvider
            initialChain={defaultChain}
            theme={darkTheme({
              accentColor: '#14b8a6',
              accentColorForeground: 'white',
              borderRadius: 'medium',
              overlayBlur: 'small',
            })}
          >
            <AuthProvider>{children}</AuthProvider>
          </RainbowKitProvider>
        </RelayKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
