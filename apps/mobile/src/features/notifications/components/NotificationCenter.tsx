import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonShimmer } from '@/components/feedback/SkeletonShimmer';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCard } from './NotificationCard';
import type { Notification } from '../services/notificationService';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 6;

function NotificationSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonIcon}>
        <SkeletonShimmer width={44} height={44} borderRadius={12} />
      </View>
      <View style={styles.skeletonContent}>
        <SkeletonShimmer width="70%" height={16} borderRadius={4} />
        <View style={styles.skeletonBodyRow}>
          <SkeletonShimmer width="90%" height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <NotificationSkeleton key={index} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<NotificationCenter>` — full notification list, reusable across all role
 * screens (teacher, parent, admin).
 *
 * Features:
 * - Infinite scrolling via FlashList
 * - Pull to refresh
 * - Empty state with bee Lottie animation
 * - Skeleton loading placeholders during initial load
 * - Swipe-to-dismiss on individual notification cards
 *
 * ```tsx
 * <NotificationCenter />
 * ```
 */
export function NotificationCenter() {
  const router = useRouter();
  const {
    notifications,
    isLoading,
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

  const keyExtractor = useCallback(
    (item: Notification) => item.id,
    [],
  );

  // -- Loading state ------------------------------------------------------

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // -- Empty state --------------------------------------------------------

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="All caught up!"
        message="No new notifications"
        lottieSource="https://assets3.lottiefiles.com/packages/lf20_jk6c1n2n.json"
      />
    );
  }

  // -- Notification list --------------------------------------------------

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
          <Text variant="bodySmall" color={colors.text.secondary}>
            {unreadCount} unread
          </Text>
          <Pressable
            onPress={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            hitSlop={8}
            style={({ pressed }) => [
              styles.markAllButton,
              (pressed || isMarkingAllAsRead) && styles.markAllButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: isMarkingAllAsRead }}
            accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={colors.primary.blue}
            />
            <Text variant="captionBold" color={colors.primary.blue}>
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
            <View style={styles.footer}>
              <SkeletonShimmer width="60%" height={14} borderRadius={4} />
            </View>
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
    paddingBottom: spacing.xl,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  markAllButtonPressed: {
    opacity: 0.5,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.cream,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  skeletonIcon: {
    marginRight: spacing.sm + 4,
  },
  skeletonContent: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonBodyRow: {
    marginTop: 4,
  },
});

export default NotificationCenter;
