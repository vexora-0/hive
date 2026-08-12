import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { colors, spacing, radius, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text, Badge, Chip } from '@/components/ui';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { formatRupees } from '@/features/orders/constants/products';
import { ORDER_STATUS } from '@/features/orders/constants/orderStatus';
import { formatOrderNumber } from '@/features/orders/utils/orderNumber';
import { useAdminOrders } from '@/features/admin/hooks/useAdminOrders';
import { OrderStatusSheet } from '@/features/admin/components/OrderStatusSheet';
import type { AdminOrder } from '@/features/admin/services/adminService';
import type { OrderStatus } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ label: string; value: OrderStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Placed', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'On the way', value: 'shipped' },
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function OrderRow({
  order,
  onPress,
}: {
  order: AdminOrder;
  onPress: (order: AdminOrder) => void;
}) {
  const status = ORDER_STATUS[order.status];

  return (
    <Pressable
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${formatOrderNumber(order.id)}, ${status.label}, ${formatRupees(order.total_cents)}. Tap to change its status.`}
    >
      <View style={styles.rowMain}>
        <Text variant="bodySmallBold">#{formatOrderNumber(order.id)}</Text>
        <Text variant="caption" color={colors.text.tertiary}>
          {formatDate(order.created_at)}
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
// Screen
// ---------------------------------------------------------------------------

/**
 * Admin orders screen — the fulfilment queue.
 *
 * Orders were created and then nothing could ever move them: six statuses
 * existed in the schema and `pending` was the only one reachable. Tapping a
 * row advances it, and the parent is notified on every step.
 */
export default function OrdersScreen() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(
    undefined,
  );
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const {
    orders,
    isLoading,
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
    ({ item }: { item: AdminOrder }) => (
      <OrderRow order={item} onPress={setSelected} />
    ),
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

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Fulfilment" eyebrow="Orders to work through" />

      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              selected={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Chip>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonShimmer
                key={i}
                width="100%"
                height={68}
                borderRadius={radius.sm}
                index={i}
              />
            ))}
          </View>
        ) : (
          <FlashList
            data={orders}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <EmptyState
                icon="bag-handle-outline"
                title={statusFilter ? 'Nothing in this stage' : 'No orders yet'}
                message={
                  statusFilter
                    ? `No orders are at "${ORDER_STATUS[statusFilter].label}" right now.`
                    : 'Orders placed by parents arrive here for fulfilment.'
                }
              />
            }
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
        )}
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
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  skeletonList: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    gap: spacing.ms,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  rowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
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
});
