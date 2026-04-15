import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { type ListRenderItem } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui';
import { PolaroidCard } from '@/components/media';
import { MasonryGrid } from '@/components/media';
import { ChildSwitcher, type ChildItem } from '@/components/forms';
import { ScreenContainer } from '@/components/layout';
import { EmptyState, OfflineBanner } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { useChildren, type ChildWithClass } from '@/features/parent/hooks/useChildren';
import { useFeed } from '@/features/parent/hooks/useFeed';
import { usePhotoActions } from '@/features/parent/hooks/usePhotoActions';
import { FeedSkeleton } from '@/features/parent/components/FeedSkeleton';
import { PhotoActionSheet } from '@/features/parent/components/PhotoActionSheet';
import type { FeedPhoto } from '@/features/parent/services/parentService';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Parent Feed screen.
 *
 * - ChildSwitcher at the top (horizontal avatar scroll).
 * - MasonryGrid of PolaroidCards below.
 * - Pull to refresh.
 * - Infinite scroll via onEndReached.
 * - Offline banner when disconnected.
 * - Empty state when no photos exist.
 * - Skeleton loading during initial load.
 */
export default function FeedScreen() {
  const { isOffline } = useNetworkStatus();
  const {
    children,
    isLoading: isLoadingChildren,
    selectedChild,
    setSelectedChild,
  } = useChildren();

  const {
    photos,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingFeed,
    refetch,
    isRefetching,
  } = useFeed(selectedChild?.id);

  const {
    selectedPhoto,
    setSelectedPhoto,
    clearSelectedPhoto,
    handleAction,
  } = usePhotoActions();

  // ---- Map children to the ChildItem shape expected by ChildSwitcher ----
  const childItems: ChildItem[] = useMemo(
    () =>
      children.map((c) => ({
        id: c.id,
        name: c.fullName,
        avatarUrl: c.avatarUrl,
      })),
    [children],
  );

  const handleChildSelect = useCallback(
    (item: ChildItem) => {
      const child = children.find((c) => c.id === item.id);
      if (child) {
        setSelectedChild(child);
      }
    },
    [children, setSelectedChild],
  );

  // ---- Photo interactions -----------------------------------------------
  const handlePhotoPress = useCallback(
    (photo: FeedPhoto) => {
      handleAction('viewFullScreen', photo);
    },
    [handleAction],
  );

  const handlePhotoLongPress = useCallback(
    async (photo: FeedPhoto) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedPhoto(photo);
    },
    [setSelectedPhoto],
  );

  // ---- Infinite scroll ---------------------------------------------------
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ---- Render item -------------------------------------------------------
  const renderItem: ListRenderItem<FeedPhoto> = useCallback(
    ({ item }) => (
      <PolaroidCard
        id={item.id}
        uri={item.thumbnailUri ?? item.uri}
        blurhash={item.blurhash ?? undefined}
        caption={item.caption ?? undefined}
        onPress={() => handlePhotoPress(item)}
        onLongPress={() => handlePhotoLongPress(item)}
        style={styles.card}
      />
    ),
    [handlePhotoPress, handlePhotoLongPress],
  );

  // ---- Header component (child switcher) ---------------------------------
  const ListHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {children.length > 0 && (
          <ChildSwitcher
            children={childItems}
            selectedId={selectedChild?.id}
            onSelect={handleChildSelect}
          />
        )}
      </View>
    ),
    [childItems, selectedChild?.id, handleChildSelect, children.length],
  );

  // ---- Footer component (loading indicator) ------------------------------
  const ListFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary.amber} />
      </View>
    );
  }, [isFetchingNextPage]);

  // ---- Loading state -----------------------------------------------------
  const isInitialLoading = isLoadingChildren || isLoadingFeed;

  if (isInitialLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Hive" />
        <FeedSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Hive" />
      <OfflineBanner visible={isOffline} />

      <MasonryGrid
        data={photos}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            title="No photos yet"
            message="Ask your teacher to share some moments."
          />
        }
      />

      <PhotoActionSheet
        photo={selectedPhoto}
        isVisible={selectedPhoto !== null}
        onClose={clearSelectedPhoto}
        onAction={handleAction}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: spacing.sm,
  },
  card: {
    flex: 1,
    margin: spacing.xs,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
