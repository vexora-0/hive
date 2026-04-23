import { useMemo, useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import {
  getSchools,
  createSchool as createSchoolApi,
  createClass as createClassApi,
  type AdminSchool,
  type CreateSchoolData,
  type CreateClassData,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const SCHOOLS_KEY = ['admin', 'schools'] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useAdminSchools` -- paginated school list with create-school mutation.
 *
 * ```ts
 * const {
 *   schools, isLoading, fetchNextPage, hasNextPage, createSchool,
 * } = useAdminSchools();
 * ```
 */
export function useAdminSchools() {
  const queryClient = useQueryClient();

  // ── Infinite query ──────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: SCHOOLS_KEY,
    queryFn: ({ pageParam }) =>
      getSchools(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: STALE_TIME_MS,
  });

  // ── Flatten pages ───────────────────────────────────────────────────
  const schools: AdminSchool[] = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  // ── Create school mutation ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (schoolData: CreateSchoolData) => createSchoolApi(schoolData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHOOLS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  const createSchool = useCallback(
    (schoolData: CreateSchoolData) => createMutation.mutateAsync(schoolData),
    [createMutation],
  );

  // ── Create class mutation ──────────────────────────────────────────
  const createClassMutation = useMutation({
    mutationFn: ({ schoolId, data }: { schoolId: string; data: CreateClassData }) =>
      createClassApi(schoolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHOOLS_KEY });
    },
  });

  const createClass = useCallback(
    (schoolId: string, data: CreateClassData) =>
      createClassMutation.mutateAsync({ schoolId, data }),
    [createClassMutation],
  );

  return {
    schools,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
    createSchool,
    isCreating: createMutation.isPending,
    createClass,
    isCreatingClass: createClassMutation.isPending,
  };
}
