import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  colors,
  spacing,
  radius,
  layout,
  shadows,
  platformShadow,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonShimmer } from '@/components/feedback/SkeletonShimmer';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCard } from './NotificationCard';
import type { Notification } from '../services/notificationService';

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * How many placeholder rows to draw.
 *
 * Five, not six: five rows of the real card height fill the first screenful on
 * every phone the app supports without running a sixth one off the bottom edge,
 * where it is doing nothing but costing an animation.
 */
const SKELETON_COUNT = 5;

/** Mirrors `NotificationCard`: a 40pt tile, a title line and a body line. */
const TILE_SIZE = 40;
const CARD_MIN_HEIGHT = MIN_TAP_SIZE + spacing.lg;

/**
 * One placeholder row.
 *
 * Built to the card's own measurements — same 22pt corner, same paper, same
 * 40pt tile at the same 10pt radius, same padding, same minimum height — so
 * that when the notifications land nothing on the screen moves. A skeleton
 * whose shape does not match what replaces it is a reflow with extra steps.
 *
 * The 200ms wait before any of this appears belongs to `SkeletonShimmer`
 * itself, so a warm cache renders straight to content with no grey flash. The
 * hand-rolled six-row version this replaces had no delay at all.
 */
function NotificationRowSkeleton({ index }: { index: number }) {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonShimmer
        width={TILE_SIZE}
        height={TILE_SIZE}
        borderRadius={radius.xs}
        index={index}
      />
      <View style={styles.skeletonContent}>
        <SkeletonShimmer width="62%" height={14} index={index} />
        <SkeletonShimmer width="88%" height={12} index={index + 1} />
      </View>
    </View>
  );
}

function NotificationsSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <NotificationRowSkeleton key={index} index={index} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<NotificationCenter>` — everything that has happened, newest first.
 *
 * One component behind three tabs: the parent's, the teacher's and the admin's
 * notification screens are twenty-five byte-identical lines each, wrapping
 * this. The API returns whatever belongs to the authenticated user, so there is
 * nothing role-specific to say here.
 *
 * **Four states, and the empty one is not a failure.** An inbox with nothing in
 * it is the good outcome — you have seen everything — so it takes the first-use
 * variant and, deliberately, **no call to action**: there is no button that
 * would fill it, and a dead button teaches people that Hive's buttons do not
 * work. A failed request is a different sentence entirely and gets its own
 * state with a retry, because a dropped connection used to render "You're all
 * caught up", which is the app telling a parent their inbox is clear when it
 * has no idea.
 */
export function NotificationCenter() {
  const router = useRouter();
  const {
    notifications,
    isLoading,
    isError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
    unreadCount,
  } = useNotifications();

  // -- Handlers -----------------------------------------------------------

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePress = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }

      // Every notification already carries the id of the thing it is about —
      // `photo_id` from the database triggers, `order_id` from the order
      // service — and none of it was used, so tapping "New photo of Ava" only
      // turned the row grey. Photo notifications now open the photo.
      //
      // Order notifications have no detail route to open (there is no
      // orders/[id] screen), so they are deliberately left as read-only
      // rather than navigated somewhere misleading.
      const payload = (notification.data ?? {}) as { photo_id?: string };
      if (payload.photo_id) {
        router.push({
          pathname: '/(parent)/photo/[id]',
          params: { id: payload.photo_id },
        } as never);
      }
    },
    [markAsRead, router],
  );

  const handleDismiss = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
    },
    [markAsRead],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // -- Render helpers -----------------------------------------------------

  // No entrance animation on the rows. FlashList keeps a pool of cells and
  // hands a recycled one new props as you scroll, so a staggered entrance
  // re-fires under the finger mid-scroll — the list arrives as content, and
  // only the screen around it is choreographed.
  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationCard
        notification={item}
        onPress={handlePress}
        onDismiss={handleDismiss}
      />
    ),
    [handlePress, handleDismiss],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  // -- 1. Loading ---------------------------------------------------------

  if (isLoading) {
    return <NotificationsSkeleton />;
  }

  // -- 2. The request failed, and there is nothing to fall back on --------
  //
  // The length check is load-bearing. React Query flips the query to `error`
  // on a **failed refetch too**, cached pages and all, so testing `isError`
  // alone would wipe a parent's full inbox off the screen the moment a
  // pull-to-refresh in a tunnel ran out of retries. Stale notifications are far
  // better than a panel saying there are none: keep what we have, and show this
  // only when the alternative is a blank page.

  if (isError && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          variant="error"
          title="We couldn't load your updates."
          message="Check your connection and try again — nothing has been lost."
          action={{ label: 'Try again', onPress: handleRetry }}
        />
      </View>
    );
  }

  // -- 3. Nothing to show -------------------------------------------------

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          variant="first-use"
          illustration="plane"
          title="You're all caught up."
          message="New photos, orders and updates land here as they happen."
        />
      </View>
    );
  }

  // -- 4. Content ---------------------------------------------------------

  return (
    <View style={styles.container}>
      {/*
        Sits above the list rather than inside it as a ListHeaderComponent:
        the point of this control is to clear a backlog, and a backlog is
        exactly the case where a scrolling header would already be off-screen
        by the time the user wants it.
      */}
      {unreadCount > 0 && (
        <View style={styles.toolbar}>
          <Text variant="bodySmallBold" color={colors.text.secondary}>
            {unreadCount} unread
          </Text>
          <Pressable
            onPress={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            style={({ pressed }) => [
              styles.markAll,
              (pressed || isMarkingAllAsRead) && styles.markAllPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: isMarkingAllAsRead }}
            accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={colors.text.accent}
            />
            <Text variant="captionBold" color={colors.text.accent}>
              Mark all read
            </Text>
          </Pressable>
        </View>
      )}

      <FlashList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          isFetchingNextPage ? (
            // The next page arriving looks like the page you have: one more
            // row of the same shape, not a spinner in the margin.
            <NotificationRowSkeleton index={0} />
          ) : null
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: layout.tabBarClearance,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.sm,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    // Was ~41pt tall, which is under the floor every other control in the app
    // honours. Text-only controls are where this slips.
    minHeight: MIN_TAP_SIZE,
    // Keeps the label on the screen edge despite the padding above.
    marginRight: -spacing.sm,
  },
  markAllPressed: {
    opacity: 0.5,
  },

  // ── Skeleton — mirrors NotificationCard exactly ──────────────────────
  skeletonList: {
    flex: 1,
    paddingTop: spacing.sm,
    backgroundColor: colors.background.cream,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    marginHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.ms,
    padding: spacing.md,
    minHeight: CARD_MIN_HEIGHT,
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    ...platformShadow(shadows.small),
  },
  skeletonContent: {
    flex: 1,
    gap: spacing.sm,
  },
});

export default NotificationCenter;
