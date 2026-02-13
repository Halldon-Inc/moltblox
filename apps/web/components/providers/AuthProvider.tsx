'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAccount, useSignMessage, useSwitchChain } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { defaultChain } from '@/lib/wagmi';

interface AuthUser {
  id: string;
  address: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticating: false,
  isAuthenticated: false,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authAttemptedRef = useRef<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!address || !chainId || isAuthenticating) return;

    setIsAuthenticating(true);
    try {
      // 1. Get nonce from server
      const { nonce } = await api.getNonce();

      // 2. Create EIP-4361 SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const issuedAt = new Date().toISOString();
      const messageStr = [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        '',
        'Sign in to Moltblox',
        '',
        `URI: ${origin}`,
        `Version: 1`,
        `Chain ID: ${chainId}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n');

      // 3. Sign with wallet
      const signature = await signMessageAsync({ message: messageStr });

      // 4. Verify on server
      const result = await api.verify(messageStr, signature);

      api.setAuthenticated(true);
      setUser(result.user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      // User rejected signature or server error — silently fail
      console.warn('SIWE auth failed:', err);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chainId, signMessageAsync, isAuthenticating, queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    api.setAuthenticated(false);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Auto-switch to the correct chain when wallet is on a different one
  useEffect(() => {
    if (isConnected && chainId && chainId !== defaultChain.id) {
      switchChain({ chainId: defaultChain.id });
    }
  }, [isConnected, chainId, switchChain]);

  // When wallet connects, try to authenticate
  useEffect(() => {
    if (isConnected && address && !user && !isAuthenticating) {
      // Prevent re-triggering auth for the same address after a failed attempt
      if (authAttemptedRef.current === address) return;
      authAttemptedRef.current = address;
      // Check if already authenticated via cookie first
      api
        .getMe()
        .then((res) => {
          api.setAuthenticated(true);
          setUser(res.user);
        })
        .catch(() => {
          // Not authenticated yet — start SIWE flow
          authenticate();
        });
    }
    // When wallet disconnects, clear auth
    if (!isConnected && user) {
      authAttemptedRef.current = null;
      logout();
    }
  }, [isConnected, address]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticating,
        isAuthenticated: !!user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
