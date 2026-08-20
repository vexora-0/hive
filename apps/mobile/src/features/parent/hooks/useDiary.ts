import { useQuery } from '@tanstack/react-query';

import { STALE_TIME_MS, GC_TIME_MS } from '@/theme';
import {
  getDiary,
  getDiaryChapter,
  type DiaryOutline,
  type DiaryChapterPage,
} from '../services/diaryService';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * `useDiary` — the outline of one child's journey.
 *
 * A plain query rather than an infinite one, and that is the point of the
 * endpoint: the outline is the *whole* timeline in a single bounded response,
 * so the strand can be drawn end to end the moment it lands. Nothing about the
 * screen has to wait on a cursor to know how long the year was.
 *
 * ```ts
 * const { diary, isLoading, refetch } = useDiary(child?.id);
 * ```
 */
export function useDiary(studentId?: string | null) {
  const query = useQuery<DiaryOutline, Error>({
    queryKey: ['diary', studentId],
    queryFn: () => getDiary(studentId!),
    enabled: !!studentId,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  return {
    diary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/**
 * `useDiaryChapter` — one month, fetched when the parent opens it.
 *
 * `enabled` is what makes the diary cheap: a closed chapter costs nothing, and
 * React Query keeps an opened one in cache, so collapsing and reopening a month
 * does not go back to the network. The key carries both the child and the
 * month, so switching siblings cannot serve the wrong March.
 */
export function useDiaryChapter(
  studentId: string | null | undefined,
  month: string,
  enabled: boolean,
) {
  const query = useQuery<DiaryChapterPage, Error>({
    queryKey: ['diary-chapter', studentId, month],
    queryFn: () => getDiaryChapter(studentId!, month),
    enabled: enabled && !!studentId,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  return {
    chapter: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
