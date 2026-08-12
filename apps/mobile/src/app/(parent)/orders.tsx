import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout, STALE_TIME_MS } from '@/theme';
import { ScreenContainer } from '@/components/layout';
import { SkeletonShimmer, EmptyState, useToast } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';
import { HoneycombFAB } from '@/components/animation';
import { getPhotoDetails } from '@/features/parent/services/parentService';

import { useOrders } from '@/features/orders/hooks/useOrders';
import { OrderHistoryCard } from '@/features/orders/components/OrderHistoryCard';
import { OrderDetailSheet } from '@/features/orders/components/OrderDetailSheet';
import { OrderBottomSheet } from '@/features/orders/components/OrderBottomSheet';
import type { OrderWithItems } from '@/features/orders/services/orderService';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function OrderSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonTopRow}>
        <SkeletonShimmer width={100} height={14} borderRadius={4} />
        <SkeletonShimmer width={80} height={22} borderRadius={11} />
      </View>
      <View style={styles.skeletonMiddleRow}>
        <SkeletonShimmer width={120} height={14} borderRadius={4} />
        <SkeletonShimmer width={60} height={14} borderRadius={4} />
      </View>
      <View style={styles.skeletonBottomRow}>
        <SkeletonShimmer width={40} height={16} borderRadius={4} />
        <SkeletonShimmer width={70} height={18} borderRadius={4} />
      </View>
    </View>
  );
}

function OrderSkeletonList() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 5 }).map((_, i) => (
        <OrderSkeleton key={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Orders screen -- displays the parent's full order history.
 *
 * Features:
 * - FlashList of OrderHistoryCards with infinite scroll
 * - Pull-to-refresh
 * - Skeleton loading state while the first page loads
 * - Empty state with a helpful message
 * - Tap a card to open OrderDetailSheet
 */
export default function OrdersScreen() {
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const toast = useToast();
  const router = useRouter();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOrders();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // ── Order creation sheet state ────────────────────────────────────
  const [orderSheetVisible, setOrderSheetVisible] = useState(false);
  const [orderPhotoId, setOrderPhotoId] = useState<string | null>(null);

  // Fetch photo details when photoId is provided (need URI for OrderBottomSheet)
  const {
    data: photoForOrder,
    isError: photoForOrderError,
  } = useQuery({
    queryKey: ['photo-for-order', orderPhotoId],
    queryFn: () => getPhotoDetails(orderPhotoId!),
    enabled: !!orderPhotoId,
    staleTime: STALE_TIME_MS,
  });

  // The sheet only opens once the photo has loaded, so a failed lookup used to
  // mean the parent tapped "Order Print", landed on this tab, and nothing at
  // all happened — no sheet, no message.
  useEffect(() => {
    if (photoForOrderError && orderPhotoId) {
      toast.error("Couldn't load that photo. Please try again.");
      setOrderSheetVisible(false);
      setOrderPhotoId(null);
    }
  }, [photoForOrderError, orderPhotoId, toast]);

  // When photoId param arrives (from feed or photo detail), open the order sheet
  useEffect(() => {
    if (photoId) {
      setOrderPhotoId(photoId);
      setOrderSheetVisible(true);
    }
  }, [photoId]);

  const handleOrderSheetClose = useCallback(() => {
    setOrderSheetVisible(false);
    setOrderPhotoId(null);
    // Cleared to an empty string, not undefined: a params merge may drop an
    // undefined key entirely, leaving photoId at its previous value, so
    // ordering the same photo a second time in one session would not re-fire
    // the effect above and the sheet would never reopen.
    router.setParams({ photoId: '' });
    refetch();
  }, [router, refetch]);

  const handleNewOrder = useCallback(() => {
    router.push('/(parent)/feed' as any);
  }, [router]);

  // Flatten paginated data into a single array
  const orders: OrderWithItems[] =
    data?.pages.flatMap((page) => page.orders) ?? [];

  // ── Handlers ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCardPress = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedOrderId(null);
  }, []);

  // ── Render item ──────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: OrderWithItems }) => (
      <OrderHistoryCard order={item} onPress={handleCardPress} />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: OrderWithItems) => item.id, []);

  // ── Footer loader for infinite scroll ────────────────────────────
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <OrderSkeleton />
      </View>
    );
  }, [isFetchingNextPage]);

  // ── Empty state ──────────────────────────────────────────────────
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="bag-handle-outline"
        title="No orders yet"
        message="Open a photo and tap “Order a print”. Anything you order shows up here with its progress."
        action={{ label: 'Browse photos', onPress: handleNewOrder }}
      />
    );
  }, [isLoading, handleNewOrder]);

  // ── Main render ──────────────────────────────────────────────────
  const orderCount = orders.length;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar
        large
        title="Orders"
        eyebrow={
          orderCount > 0
            ? `${orderCount} ${orderCount === 1 ? 'order' : 'orders'}`
            : undefined
        }
      />

      <View style={styles.container}>
        {isLoading && !isRefetching ? (
          <OrderSkeletonList />
        ) : (
          <FlashList
            data={orders}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={colors.primary.amberDark}
                colors={[colors.primary.amberDark]}
                progressBackgroundColor={colors.background.surface}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Order detail bottom sheet */}
        <OrderDetailSheet
          orderId={selectedOrderId}
          onClose={handleDetailClose}
        />

        {/* Order creation bottom sheet */}
        <OrderBottomSheet
          photoId={orderPhotoId ?? ''}
          photoUri={photoForOrder?.uri ?? ''}
          isVisible={orderSheetVisible && !!orderPhotoId && !!photoForOrder}
          onClose={handleOrderSheetClose}
        />

        {/* Every order starts from a photo, so the FAB goes to the feed. */}
        <HoneycombFAB
          onPress={handleNewOrder}
          accessibilityLabel="Order from a photo"
          icon={<Ionicons name="add" size={26} color={colors.ink[900]} />}
        />
      </View>
    </ScreenContainer>
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
    paddingBottom: layout.tabBarClearance,
  },

  // Skeleton
  skeletonContainer: {
    paddingTop: spacing.sm,
  },
  skeletonCard: {
    backgroundColor: colors.background.surface,
    marginHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.ms,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.ms,
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  // Footer
  footerLoader: {
    paddingVertical: spacing.sm,
  },
});
