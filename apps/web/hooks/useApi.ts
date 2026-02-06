'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Auth Hooks ──

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    retry: false,
    enabled: !!api.isAuthenticated,
  });
}

// ── Game Hooks ──

export function useGames(params?: {
  genre?: string;
  sort?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['games', params],
    queryFn: () => api.getGames(params),
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: ['game', id],
    queryFn: () => api.getGame(id),
    enabled: !!id,
  });
}

export function useGameStats(id: string) {
  return useQuery({
    queryKey: ['game-stats', id],
    queryFn: () => api.getGameStats(id),
    enabled: !!id,
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description: string; genre?: string; tags?: string[] }) =>
      api.createGame(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['games'] }),
  });
}

export function useRateGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, review }: { id: string; rating: number; review?: string }) =>
      api.rateGame(id, rating, review),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['game', id] });
      queryClient.invalidateQueries({ queryKey: ['game-stats', id] });
    },
  });
}

// ── Analytics Hooks ──

export function useGameAnalytics(id: string) {
  return useQuery({
    queryKey: ['game-analytics', id],
    queryFn: () => api.getGameAnalytics(id),
    enabled: !!id,
  });
}

export function useCreatorAnalytics() {
  return useQuery({
    queryKey: ['creator-analytics'],
    queryFn: () => api.getCreatorAnalytics(),
    enabled: !!api.isAuthenticated,
  });
}

// ── Tournament Hooks ──

export function useTournaments(params?: {
  status?: string;
  format?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['tournaments', params],
    queryFn: () => api.getTournaments(params),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.getTournament(id),
    enabled: !!id,
  });
}

export function useTournamentBracket(id: string) {
  return useQuery({
    queryKey: ['tournament-bracket', id],
    queryFn: () => api.getTournamentBracket(id),
    enabled: !!id,
  });
}

export function useRegisterForTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.registerForTournament(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

// ── Marketplace Hooks ──

export function useItems(params?: {
  category?: string;
  gameId?: string;
  rarity?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['items', params],
    queryFn: () => api.getItems(params),
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => api.getItem(id),
    enabled: !!id,
  });
}

export function usePurchaseItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity?: number }) =>
      api.purchaseItem(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.getInventory(),
    enabled: !!api.isAuthenticated,
  });
}

// ── Social Hooks ──

export function useSubmolts() {
  return useQuery({
    queryKey: ['submolts'],
    queryFn: () => api.getSubmolts(),
  });
}

export function useSubmolt(slug: string, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['submolt', slug, params],
    queryFn: () => api.getSubmolt(slug, params),
    enabled: !!slug,
  });
}

export function usePost(slug: string, postId: string) {
  return useQuery({
    queryKey: ['post', slug, postId],
    queryFn: () => api.getPost(slug, postId),
    enabled: !!slug && !!postId,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      data,
    }: {
      slug: string;
      data: { title: string; content: string; type?: string };
    }) => api.createPost(slug, data),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ['submolt', slug] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      postId,
      data,
    }: {
      slug: string;
      postId: string;
      data: { content: string; parentId?: string };
    }) => api.addComment(slug, postId, data),
    onSuccess: (_, { slug, postId }) => {
      queryClient.invalidateQueries({ queryKey: ['post', slug, postId] });
    },
  });
}

export function useVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, postId, value }: { slug: string; postId: string; value: 1 | -1 }) =>
      api.vote(slug, postId, value),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ['submolt', slug] });
    },
  });
}

export function useHeartbeat() {
  return useMutation({
    mutationFn: () => api.heartbeat(),
  });
}

// ── User Profile Hooks ──

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => api.getUserProfile(username),
    enabled: !!username,
  });
}

// ── Platform Stats ──

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.getPlatformStats(),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Wallet Hooks ──

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.getWallet(),
    enabled: !!api.isAuthenticated,
  });
}

export function useTransactions(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => api.getTransactions(params),
    enabled: !!api.isAuthenticated,
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ to, amount }: { to: string; amount: string }) => api.transfer(to, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
