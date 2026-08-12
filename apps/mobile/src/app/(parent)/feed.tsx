import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { type ListRenderItem } from '@shopify/flash-list';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui';
import { PhotoMount, MasonryGrid } from '@/components/media';
import { Reveal } from '@/components/animation';
import { ChildSwitcher, type ChildItem } from '@/components/forms';
import { ScreenContainer } from '@/components/layout';
import { EmptyState, OfflineBanner } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { useAuthStore } from '@/features/auth/stores/authStore';
import { useChildren } from '@/features/parent/hooks/useChildren';
import { useFeed } from '@/features/parent/hooks/useFeed';
import { usePhotoActions } from '@/features/parent/hooks/usePhotoActions';
import { FeedSkeleton } from '@/features/parent/components/FeedSkeleton';
import { PhotoActionSheet } from '@/features/parent/components/PhotoActionSheet';
import type { FeedPhoto } from '@/features/parent/services/parentService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** True for photos taken in the last day — drives the folded corner. */
function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const taken = new Date(iso).getTime();
  if (Number.isNaN(taken)) return false;
  return Date.now() - taken < ONE_DAY_MS;
}

/** First name only, for the header. */
function firstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Parent feed — the wall of photo mounts.
 *
 * The screen a parent opens the app for, so it is the one screen where the
 * chrome gets out of the way: a large title that collapses on scroll, the
 * child switcher only if there is more than one child, and then nothing but
 * photographs.
 */
export default function FeedScreen() {
  const { isOffline } = useNetworkStatus();
  const userEmail = useAuthStore((s) => s.user?.email) ?? 'your email address';
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
    isError: isFeedError,
    refetch,
    isRefetching,
  } = useFeed(selectedChild?.id);

  const {
    selectedPhoto,
    setSelectedPhoto,
    clearSelectedPhoto,
    handleAction,
  } = usePhotoActions();

  // Drives the collapsing header.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

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
    ({ item, index }) => (
      // Only the first screenful is staggered. Past that the mounts are
      // arriving during a scroll, and animating them in fights the finger.
      <Reveal index={index < 6 ? index : 0} style={styles.cell}>
        <PhotoMount
          id={item.id}
          uri={item.thumbnailUri ?? item.uri}
          blurhash={item.blurhash ?? undefined}
          isNew={isRecent(item.createdAt)}
          // A photo's own caption wins; otherwise attribute it to whoever took
          // it. `caption` is unused today, so in practice this is the teacher's
          // name — but the fallback keeps working if captions are ever written.
          caption={
            item.caption ?? (item.uploadedBy.name ? `by ${item.uploadedBy.name}` : undefined)
          }
          onPress={() => handlePhotoPress(item)}
          onLongPress={() => handlePhotoLongPress(item)}
        />
      </Reveal>
    ),
    [handlePhotoPress, handlePhotoLongPress],
  );

  // ---- List header --------------------------------------------------------
  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <OfflineBanner visible={isOffline} />
        <ChildSwitcher
          children={childItems}
          selectedId={selectedChild?.id}
          onSelect={handleChildSelect}
        />
      </View>
    ),
    [childItems, selectedChild?.id, handleChildSelect, isOffline],
  );

  // ---- List footer --------------------------------------------------------
  const ListFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary.amberDark} />
        </View>
      );
    }
    // Tells a parent they have reached the end rather than leaving them
    // pulling at a list that has quietly stopped.
    if (photos.length > 0 && !hasNextPage) {
      return (
        <View style={styles.footer}>
          <Text variant="caption" color={colors.text.tertiary} center>
            That's everything so far
          </Text>
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, hasNextPage, photos.length]);

  // ---- Header text --------------------------------------------------------
  const childName = firstName(selectedChild?.fullName);
  const eyebrow = selectedChild?.className
    ? `${childName ?? 'Your child'} · ${selectedChild.className}`
    : childName;

  // ---- Loading state -----------------------------------------------------
  if (isLoadingChildren || isLoadingFeed) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar large title="Moments" eyebrow={eyebrow} />
        <FeedSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Moments" eyebrow={eyebrow} scrollY={scrollY} />

      <MasonryGrid
        data={photos}
        renderItem={renderItem}
        onEndReached={handleEndReached}
        refreshing={isRefetching}
        onRefresh={refetch}
        onScroll={onScroll}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          // A failed request must not be dressed up as an empty feed — telling
          // a parent their child has no photos when the request errored is a
          // worse lie than showing the error.
          isFeedError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load photos"
              message="Check your connection and try again."
              action={{ label: 'Try again', onPress: () => refetch() }}
            />
          ) : children.length === 0 ? (
            <EmptyState
              icon="person-add-outline"
              title="No children linked yet"
              message={
                'Your school needs to link your child to your account. Contact them with the email you signed up with:\n\n' +
                userEmail
              }
            />
          ) : (
            <EmptyState
              icon="images-outline"
              title="No photos yet"
              message={`When ${childName ?? 'your child'}'s teacher shares a moment, it will appear here.`}
            />
          )
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
  listHeader: {
    // Cancels the grid's own horizontal padding so the switcher can scroll
    // edge to edge while the mounts stay inset.
    marginHorizontal: -spacing.md,
    paddingBottom: spacing.sm,
  },
  cell: {
    paddingHorizontal: spacing.xs + 2,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
