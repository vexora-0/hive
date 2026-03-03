import { useQuery } from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import {
  getDashboardStats,
  type DashboardStats,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

const DASHBOARD_KEY = ['admin', 'dashboard'] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useAdminDashboard` -- fetches aggregate statistics for the admin overview.
 *
 * Uses React Query with stale-time caching and supports pull-to-refresh via
 * the returned `refetch` function.
 *
 * ```ts
 * const { stats, isLoading, refetch } = useAdminDashboard();
 * ```
 */
export function useAdminDashboard() {
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: getDashboardStats,
    staleTime: STALE_TIME_MS,
  });

  return {
    stats: data ?? null,
    isLoading,
    isRefetching,
    refetch,
    error,
  };
}
