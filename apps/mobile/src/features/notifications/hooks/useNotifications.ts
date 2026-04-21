import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import { logger } from '@/utils/logger';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  type Notification,
  type NotificationsPage,
} from '../services/notificationService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const NOTIFICATIONS_KEY = ['notifications'] as const;
const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

// ---------------------------------------------------------------------------
// useNotifications — infinite paginated list
// ---------------------------------------------------------------------------

/**
 * `useNotifications` — fetches the current user's notifications with
 * cursor-based infinite scrolling.
 *
 * ```ts
 * const { notifications, isLoading, fetchNextPage, hasNextPage, refetch } =
 *   useNotifications();
 * ```
 */
function useNotificationsList() {
  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam }) =>
      getNotifications(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: STALE_TIME_MS,
  });

  const notifications =
    query.data?.pages.flatMap((page) => page.notifications) ?? [];

  return {
    notifications,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

// ---------------------------------------------------------------------------
// useUnreadCount — polls every 30 seconds
// ---------------------------------------------------------------------------

/**
 * `useUnreadCount` — returns the number of unread notifications and
 * re-fetches automatically every 30 seconds.
 */
function useUnreadCount() {
  const { data, isLoading } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => getUnreadCount(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return {
    unreadCount: data?.count ?? 0,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// useMarkAsRead — optimistic mutation
// ---------------------------------------------------------------------------

/**
 * `useMarkAsRead` — marks a notification as read and optimistically updates
 * both the notification list cache and the unread-count cache.
 */
function useMarkAsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markAsRead(notificationId),

    onMutate: async (notificationId: string) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic
      // update.
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_KEY });

      // Snapshot previous values for rollback.
      const previousNotifications = queryClient.getQueryData(NOTIFICATIONS_KEY);
      const previousUnreadCount = queryClient.getQueryData(UNREAD_COUNT_KEY);

      // Optimistically mark the notification as read in the list cache.
      queryClient.setQueryData(
        NOTIFICATIONS_KEY,
        (old: { pages: NotificationsPage[]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) =>
                n.id === notificationId ? { ...n, is_read: true } : n,
              ),
            })),
          };
        },
      );

      // Optimistically decrement the unread count.
      queryClient.setQueryData(
        UNREAD_COUNT_KEY,
        (old: { count: number } | undefined) => {
          if (!old) return old;
          return { count: Math.max(0, old.count - 1) };
        },
      );

      return { previousNotifications, previousUnreadCount };
    },

    onError: (_error, _notificationId, context) => {
      // Rollback on error.
      logger.error('Failed to mark notification as read:', _error);

      if (context?.previousNotifications) {
        queryClient.setQueryData(NOTIFICATIONS_KEY, context.previousNotifications);
      }
      if (context?.previousUnreadCount) {
        queryClient.setQueryData(UNREAD_COUNT_KEY, context.previousUnreadCount);
      }
    },

    onSettled: () => {
      // Refetch to ensure server state is in sync.
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Composite hook — public API
// ---------------------------------------------------------------------------

/**
 * `useNotifications` — single hook that composes the notification list,
 * unread count, and mark-as-read mutation into a unified API.
 *
 * ```ts
 * const {
 *   notifications,
 *   isLoading,
 *   fetchNextPage,
 *   hasNextPage,
 *   unreadCount,
 *   markAsRead,
 *   refetch,
 * } = useNotifications();
 * ```
 */
export function useNotifications() {
  const list = useNotificationsList();
  const unread = useUnreadCount();
  const markMutation = useMarkAsReadMutation();

  return {
    // List
    notifications: list.notifications,
    isLoading: list.isLoading,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    hasNextPage: list.hasNextPage,
    refetch: list.refetch,
    isRefetching: list.isRefetching,

    // Unread count
    unreadCount: unread.unreadCount,

    // Mark as read
    markAsRead: markMutation.mutate,
  };
}
