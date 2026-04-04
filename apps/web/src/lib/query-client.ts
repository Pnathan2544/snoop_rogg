'use client';

import { QueryClient } from '@tanstack/react-query';

let queryClientSingleton: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server side: always create new instance
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000, // 30s
        },
      },
    });
  }
  // Client side: reuse singleton
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
          refetchInterval: 30 * 1000, // auto-refresh every 30s
        },
      },
    });
  }
  return queryClientSingleton;
}
