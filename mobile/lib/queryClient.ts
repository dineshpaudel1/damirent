import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient shared between the React tree and the auth store.
 * Exporting it here avoids a circular dependency and lets the store call
 * queryClient.clear() on logout without needing access to React context.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});
