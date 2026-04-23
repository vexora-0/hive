import { useState, useMemo, useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import type { UserRole } from '@/types/supabase';
import {
  getUsers,
  updateUserRole,
  assignUserToSchool,
  type AdminUser,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const USERS_KEY = ['admin', 'users'] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useAdminUsers` -- paginated user list with search, role filtering, and
 * role mutation support.
 *
 * ```ts
 * const {
 *   users, isLoading, fetchNextPage, hasNextPage,
 *   search, setSearch, roleFilter, setRoleFilter,
 *   updateRole,
 * } = useAdminUsers();
 * ```
 */
export function useAdminUsers() {
  const queryClient = useQueryClient();

  // ── Local filter state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>(undefined);

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
    queryKey: [...USERS_KEY, search, roleFilter],
    queryFn: ({ pageParam }) =>
      getUsers(search || undefined, roleFilter, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: STALE_TIME_MS,
  });

  // ── Flatten pages into a single array ───────────────────────────────
  const users: AdminUser[] = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  // ── Role update mutation ────────────────────────────────────────────
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      // Invalidate users list and dashboard stats (user counts may change)
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  const updateRole = useCallback(
    (userId: string, role: UserRole) =>
      roleMutation.mutateAsync({ userId, role }),
    [roleMutation],
  );

  // ── Assign to school mutation ─────────────────────────────────────
  const schoolMutation = useMutation({
    mutationFn: ({ userId, schoolId }: { userId: string; schoolId: string | null }) =>
      assignUserToSchool(userId, schoolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'schools'] });
    },
  });

  const assignSchool = useCallback(
    (userId: string, schoolId: string | null) =>
      schoolMutation.mutateAsync({ userId, schoolId }),
    [schoolMutation],
  );

  return {
    users,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    updateRole,
    isUpdatingRole: roleMutation.isPending,
    assignSchool,
    isAssigningSchool: schoolMutation.isPending,
  };
}
