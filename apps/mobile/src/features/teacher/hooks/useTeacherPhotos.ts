import { useInfiniteQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { logger } from '@/utils/logger';
import { STALE_TIME_MS, FEED_PAGE_SIZE } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Photo {
  id: string;
  uri: string;
  thumbnailUri?: string;
  blurhash?: string;
  caption?: string;
  classId: string;
  createdAt: string;
  taggedStudentIds?: string[];
}

interface PhotosPage {
  photos: Photo[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

interface BackendPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  class_id: string;
  created_at: string;
}

async function fetchPhotos(classId: string, cursor?: string): Promise<PhotosPage> {
  const params = new URLSearchParams();
  if (classId) params.set('classId', classId);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(FEED_PAGE_SIZE));

  const endpoint = `/photos?${params.toString()}`;
  const res = await apiRequest<{
    success: true;
    data: BackendPhoto[];
    cursor: string | null;
  }>(endpoint);

  const photos: Photo[] = (res.data ?? []).map((p) => ({
    id: p.id,
    uri: p.url,
    thumbnailUri: p.thumbnailUrl ?? undefined,
    blurhash: p.blurhash ?? undefined,
    classId: p.class_id,
    createdAt: p.created_at,
  }));

  return { photos, nextCursor: res.cursor ?? null };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useTeacherPhotos` -- infinite-query hook for fetching a teacher's recent
 * photos with cursor-based pagination.
 *
 * ```ts
 * const { photos, fetchNextPage, hasNextPage, isLoading, refetch } = useTeacherPhotos(classId);
 * ```
 */
export function useTeacherPhotos(classId: string) {
  const query = useInfiniteQuery({
    queryKey: ['teacher-photos', classId],
    queryFn: ({ pageParam }) => fetchPhotos(classId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!classId,
    staleTime: STALE_TIME_MS,
  });

  const photos = query.data?.pages.flatMap((page) => page.photos) ?? [];

  return {
    photos,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}
