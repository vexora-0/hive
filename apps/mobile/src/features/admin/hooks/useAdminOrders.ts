import { useMemo, useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import { useToast } from '@/components/feedback';
import { apiErrorMessage } from '@/utils/errorMessage';
import type { OrderStatus } from '@/types/supabase';
import {
  getSchoolOrders,
  updateOrderStatus as updateOrderStatusApi,
  type AdminOrder,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const ORDERS_KEY = ['admin', 'orders'] as const;

const ordersKey = (status?: OrderStatus) =>
  status ? ([...ORDERS_KEY, status] as const) : ORDERS_KEY;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useAdminOrders` -- the fulfilment queue, with the mutation that advances an
 * order through it.
 *
 * ```ts
 * const { orders, isLoading, updateStatus } = useAdminOrders('pending');
 * ```
 *
 * The status filter is part of the query key, so switching filters fetches
 * rather than re-filtering a partially-paginated list client-side.
 */
export function useAdminOrders(status?: OrderStatus) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ordersKey(status),
    queryFn: ({ pageParam }) =>
      getSchoolOrders({ cursor: pageParam as string | undefined, status }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: STALE_TIME_MS,
  });

  const orders: AdminOrder[] = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  // Invalidates every status bucket, not just the one on screen: an order
  // moving from pending to confirmed leaves one list and joins another, so
  // invalidating only the current filter would leave the other stale.
  const updateMutation = useMutation({
    mutationFn: ({ orderId, next }: { orderId: string; next: OrderStatus }) =>
      updateOrderStatusApi(orderId, next),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      toast.success(`Order marked ${variables.next}`);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, 'Could not update this order.')),
  });

  const updateStatus = useCallback(
    (orderId: string, next: OrderStatus) =>
      updateMutation.mutateAsync({ orderId, next }),
    [updateMutation],
  );

  return {
    orders,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
    updateStatus,
    isUpdating: updateMutation.isPending,
  };
}
