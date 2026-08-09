import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

// React Query's focus tracking is built on browser window events, so on native
// `refetchOnWindowFocus` does nothing at all unless the focus manager is told
// what "focused" means. Without this the option below is inert.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: (failureCount, error) => {
        // Don't retry anything the server has already refused on its own terms.
        // A 4xx means the request was wrong, not unlucky; repeating it verbatim
        // cannot change the answer. 408 and 429 are the exceptions — both
        // explicitly mean "try again later".
        const status =
          error instanceof Error && 'status' in error
            ? (error as Error & { status?: number }).status
            : undefined;
        if (
          typeof status === 'number' &&
          status >= 400 &&
          status < 500 &&
          status !== 408 &&
          status !== 429
        ) {
          return false;
        }
        return failureCount < 2;
      },
      // Photo URLs are signed and expire, so a screen left mounted while the
      // app is backgrounded comes back holding URLs the storage layer will
      // refuse. Refetching on focus re-mints them. Nothing else in the app
      // depends on stale data staying stale, and `staleTime` still bounds how
      // often this actually issues a request.
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
