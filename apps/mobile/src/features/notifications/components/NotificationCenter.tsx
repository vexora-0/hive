import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { colors, spacing } from '@/theme';
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
  const {
    notifications,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
    markAsRead,
  } = useNotifications();

  // -- Handlers -----------------------------------------------------------

  const handlePress = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
    },
    [markAsRead],
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
      <FlashList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={88}
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
