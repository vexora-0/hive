import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { colors, spacing, radius, layout, MIN_TAP_SIZE } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text, Badge, Chip, Avatar } from '@/components/ui';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { formatRupees } from '@/features/orders/constants/products';
import { ORDER_STATUS } from '@/features/orders/constants/orderStatus';
import { formatOrderNumber } from '@/features/orders/utils/orderNumber';
import { useAdminOrders } from '@/features/admin/hooks/useAdminOrders';
import {
  OrderStatusSheet,
  orderRecipient,
  orderPlaced,
} from '@/features/admin/components/OrderStatusSheet';
import type { AdminOrder } from '@/features/admin/services/adminService';
import type { OrderStatus } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Filters — four labelled pills, which is the cap.
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ label: string; value: OrderStatus | undefined }> = [
  { label: 'Everything', value: undefined },
  { label: 'Placed', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'On the way', value: 'shipped' },
];

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

/**
 * One order, read as a delivery to a household rather than as a record.
 *
 * The row used to open with `#A3F2` in bold and put the date beside it, which
 * is a table export with the column headings removed. It now leads with where
 * the prints are going, and the order number keeps company with the date in
 * tertiary ink underneath — present when an admin needs to quote it, silent
 * the rest of the time.
 */
function OrderRow({
  order,
  onPress,
}: {
  order: AdminOrder;
  onPress: (order: AdminOrder) => void;
}) {
  const status = ORDER_STATUS[order.status];
  const recipient = orderRecipient(order);

  return (
    <Pressable
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${recipient}, ${formatRupees(order.total_cents)}, ${status.label}, ${orderPlaced(order.created_at).toLowerCase()}`}
      accessibilityHint="Opens this order's next step"
    >
      <Avatar name={recipient} size="md" />

      <View style={styles.rowMain}>
        <Text variant="bodyBold" numberOfLines={1}>
          {recipient}
        </Text>
        <Text variant="caption" color={colors.text.tertiary} numberOfLines={1}>
          {orderPlaced(order.created_at)} · #{formatOrderNumber(order.id)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text variant="price" style={styles.rowTotal}>
          {formatRupees(order.total_cents)}
        </Text>
        <Badge variant={status.variant} dot>
          {status.label}
        </Badge>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — the same row, in grey: circle, two lines, a price and a stamp.
// ---------------------------------------------------------------------------

function QueueSkeleton() {
  return (
    <View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonShimmer width={44} height={44} borderRadius={radius.pill} index={i} />
          <View style={styles.skeletonMain}>
            <SkeletonShimmer width="62%" height={15} borderRadius={radius.xs} index={i} />
            <SkeletonShimmer width="44%" height={12} borderRadius={radius.xs} index={i} />
          </View>
          <View style={styles.skeletonRight}>
            <SkeletonShimmer width={64} height={18} borderRadius={radius.xs} index={i} />
            <SkeletonShimmer width={54} height={16} borderRadius={radius.xs} index={i} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Fulfilment — the one queue on Hive with work in it.
 *
 * Orders were created and then nothing could ever move them: six statuses
 * existed in the schema and `pending` was the only one reachable. A row opens a
 * sheet with the expected next step on a pinned button, so a queue can be
 * cleared with a thumb, and the parent is told at every step.
 *
 * There is no primary action floating over this list, and there should not be:
 * an administrator cannot place an order — parents do that from a photograph of
 * their own child. The action on this screen lives in every row.
 */
export default function OrdersScreen() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const {
    orders,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    updateStatus,
    isUpdating,
  } = useAdminOrders(statusFilter);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Failures are reported by the toast in useAdminOrders. Catching stops the
  // rejection escaping unhandled.
  const handleSelect = useCallback(
    async (order: AdminOrder, next: OrderStatus) => {
      try {
        await updateStatus(order.id, next);
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [updateStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminOrder }) => <OrderRow order={item} onPress={setSelected} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.text.accent} />
      </View>
    );
  }, [isFetchingNextPage]);

  // The four states. A failed request is never dressed up as an empty queue —
  // "no orders yet" and "we could not ask" are opposite pieces of news for
  // anyone running a school.
  const renderEmpty = useCallback(() => {
    if (isLoading) return <QueueSkeleton />;

    if (isError) {
      return (
        <EmptyState
          variant="error"
          title="Couldn't load the queue."
          message="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      );
    }

    if (statusFilter) {
      return (
        <EmptyState
          variant="filtered"
          title="Nothing at this stage."
          message={`No orders are ${ORDER_STATUS[statusFilter].label.toLowerCase()} right now.`}
          action={{
            label: 'Show everything',
            onPress: () => setStatusFilter(undefined),
          }}
        />
      );
    }

    return (
      <EmptyState
        variant="first-use"
        illustration="prints"
        title="No orders yet."
        message="When a parent orders prints of a photograph, they arrive here to be made."
      />
    );
  }, [isLoading, isError, statusFilter, refetch]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Fulfilment" eyebrow="Prints to make and send" />

      <View style={styles.container}>
        {/*
          The four filters wrap rather than scroll.

          They wanted about 497pt laid in a row against a 390pt screen, so the
          last one was sliced by the screen edge — and a horizontal scroller
          gives no hint that it scrolls, so a cut-off word reads as a bug
          rather than as an invitation. Four fixed options are a set worth
          seeing whole; wrapping shows all of them and costs one row of height
          at most. `(admin)/users` does the same thing for the same reason.
        */}
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              selected={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Chip>
          ))}
        </View>

        <FlashList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary.amberDark}
              colors={[colors.primary.amberDark]}
              progressBackgroundColor={colors.background.surface}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      </View>

      <OrderStatusSheet
        order={selected}
        onClose={() => setSelected(null)}
        onSelect={handleSelect}
        isUpdating={isUpdating}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.ms,
    minHeight: MIN_TAP_SIZE + spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  rowTotal: {
    // Optical alignment: tabular figures sit slightly high against a badge.
    marginTop: -2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: layout.screenPaddingHorizontal,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.ms,
    minHeight: 60,
  },
  skeletonMain: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
});
