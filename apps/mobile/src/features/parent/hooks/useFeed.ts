import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { FEED_PAGE_SIZE, STALE_TIME_MS, GC_TIME_MS } from '@/theme';
import { logger } from '@/utils/logger';
import { getFeed, type FeedPhoto, type FeedPage } from '../services/parentService';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useFeed` -- infinite-query hook for the parent photo feed.
 *
 * Uses cursor-based pagination. The cursor format is `{created_at}_{id}`,
 * returned as `nextCursor` from the API.
 *
 * The query key includes the selected child ID so the feed automatically
 * refetches when the parent switches between children.
 *
 * ```ts
 * const { photos, fetchNextPage, hasNextPage, isLoading, refetch } = useFeed(childId);
 * ```
 */
export function useFeed(selectedChildId?: string | null) {
  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['feed', selectedChildId ?? 'all'],
    queryFn: async ({ pageParam }) => {
      logger.debug('useFeed: fetching page', { selectedChildId, cursor: pageParam });
      return getFeed(
        selectedChildId ?? undefined,
        pageParam as string | undefined,
        FEED_PAGE_SIZE,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) {
        return undefined;
      }
      return lastPage.nextCursor;
    },
    enabled: true,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  // Flatten all pages into a single photo array for convenience.
  const photos = useMemo<FeedPhoto[]>(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap((page) => page.photos);
  }, [query.data?.pages]);

  return {
    photos,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
