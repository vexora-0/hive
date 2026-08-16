import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, STALE_TIME_MS } from '@/theme';
import { ScreenContainer } from '@/components/layout';
import { EmptyState, useToast } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';
import { HoneycombFAB } from '@/components/animation';
import { getPhotoDetails } from '@/features/parent/services/parentService';

import { useOrders } from '@/features/orders/hooks/useOrders';
import {
  OrderHistoryCard,
  OrderHistoryCardSkeleton,
} from '@/features/orders/components/OrderHistoryCard';
import { OrderDetailSheet } from '@/features/orders/components/OrderDetailSheet';
import { OrderBottomSheet } from '@/features/orders/components/OrderBottomSheet';
import type { OrderWithItems } from '@/features/orders/services/orderService';

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Five of the real card, with the words missing.
 *
 * This screen used to hand-roll its own three-bar placeholder, and it had
 * drifted from the card it stood in for — different padding, different radius,
 * a row the card does not have — so the list visibly relaid itself the moment
 * the orders arrived. `OrderHistoryCardSkeleton` lives beside the component it
 * mirrors, which is the only arrangement in which the two stay in step.
 */
function OrderSkeletonList() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: 5 }).map((_, i) => (
        <OrderHistoryCardSkeleton key={i} index={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * The parent's orders.
 *
 * Four states, as every list owes: the skeleton above, an **error with a
 * retry**, an empty state that does not pretend to be one, and the orders
 * themselves. The error state is the one that was missing: a failed request
 * raised a toast and then showed "No orders yet", which tells a parent whose
 * connection dropped that the print they placed last week does not exist.
 *
 * Ordering does not start here. It starts at the photograph — the FAB leads
 * back to the feed rather than opening a second, worse gallery.
 */
export default function OrdersScreen() {
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const toast = useToast();
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
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
  const { data: photoForOrder, isError: photoForOrderError } = useQuery({
    queryKey: ['photo-for-order', orderPhotoId],
    queryFn: () => getPhotoDetails(orderPhotoId!),
    enabled: !!orderPhotoId,
    staleTime: STALE_TIME_MS,
  });

  // A failed lookup used to mean the parent tapped "Order a print", landed on
  // this tab, and nothing at all happened — no sheet, no message.
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

  const handleBrowsePhotos = useCallback(() => {
    router.push('/(parent)/feed' as never);
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
    return <OrderHistoryCardSkeleton />;
  }, [isFetchingNextPage]);

  // ── Empty and failed ─────────────────────────────────────────────
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    // The host view is load-bearing: FlashList drops the empty component
    // straight into the scroll content, where `EmptyState`'s own `flex: 1`
    // resolves against a container sized by its content and collapses the
    // panel to nothing. The floor gives it something to fill.
    return (
      <View style={styles.emptyHost}>
        {isError ? (
          // A failed request is not an empty history. It gets its own state,
          // and the way out is a retry rather than a toast that has already
          // gone.
          <EmptyState
            variant="error"
            title="Couldn't load your orders."
            message="It may just be the connection. Try again in a moment."
            action={{ label: 'Try again', onPress: () => refetch() }}
          />
        ) : (
          // First use, and deliberately without a button: the way to start an
          // order is to open a photograph, and a "Browse photos" button here
          // would be the second-best route to it while the FAB is already the
          // first.
          <EmptyState
            variant="first-use"
            illustration="prints"
            title="No orders yet."
            message="Open a photo you love and tap “Order a print”. Anything you order turns up here, with its progress."
          />
        )}
      </View>
    );
  }, [isLoading, isError, refetch]);

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
                // The readable marigold: `primary.amber` is 2.03:1 and a
                // spinner drawn in it disappears against paper.
                tintColor={colors.primary.amberDark}
                colors={[colors.primary.amberDark]}
                progressBackgroundColor={colors.background.surface}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Order detail bottom sheet */}
        <OrderDetailSheet orderId={selectedOrderId} onClose={handleDetailClose} />

        {/* Order creation bottom sheet */}
        {/*
          Opens on the tap, **not on the fetch.**

          `isVisible` used to include `!!photoForOrder`, which meant the sheet
          waited for `getPhotoDetails` to come back before it appeared. When
          that request is warm — the photo viewer has already fetched the same
          photo — it is instant and nobody notices. When it is cold, the parent
          taps "Order a print", watches the app navigate to a list of their past
          orders, and then a sheet arrives on top of it a moment later. It reads
          as the button having gone to the wrong place.

          The sheet now opens immediately and the thumbnail fills in behind it.
          There is nothing to wait for: the product list, the prices and the
          address field are all local, and the photograph is decoration in a
          40px square. `HiveImage` shows its own placeholder for an empty uri,
          so the gap is a soft rectangle rather than a broken image.
        */}
        <OrderBottomSheet
          photoId={orderPhotoId ?? ''}
          photoUri={photoForOrder?.uri ?? ''}
          isVisible={orderSheetVisible && !!orderPhotoId}
          onClose={handleOrderSheetClose}
        />

        {/* Every order starts from a photograph, so the one persistent action
            on this screen leads back to the wall. */}
        <HoneycombFAB
          onPress={handleBrowsePhotos}
          accessibilityLabel="Browse photos to order a print"
          icon={<Ionicons name="images-outline" size={24} color={colors.ink[900]} />}
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
    paddingTop: spacing.sm,
    paddingBottom: layout.tabBarClearance,
  },
  skeletonList: {
    paddingTop: spacing.sm,
  },

  /**
   * A floor under the empty and error states — see the note at the call site.
   * Without it FlashList's empty component resolves to zero height and the
   * state is perfectly correct and perfectly invisible.
   */
  emptyHost: {
    minHeight: 420,
  },
});
