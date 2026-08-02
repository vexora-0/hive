import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { colors, spacing, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text } from '@/components/ui/Text';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { formatCents } from '@/features/orders/constants/products';
import { useAdminOrders } from '@/features/admin/hooks/useAdminOrders';
import {
  OrderStatusSheet,
  STATUS_LABELS,
} from '@/features/admin/components/OrderStatusSheet';
import type { AdminOrder } from '@/features/admin/services/adminService';
import type { OrderStatus } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ label: string; value: OrderStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Shipped', value: 'shipped' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.primary.amber,
  confirmed: colors.primary.blue,
  processing: colors.primary.lavender,
  shipped: colors.primary.mint,
  delivered: colors.success.main,
  cancelled: colors.error.main,
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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
  return (
    <Pressable
      onPress={() => onPress(order)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id.slice(0, 8)}, ${STATUS_LABELS[order.status]}`}
    >
      <View style={styles.rowMain}>
        <Text variant="bodyBold">#{order.id.slice(0, 8).toUpperCase()}</Text>
        <Text variant="caption" color={colors.text.secondary}>
          {formatDate(order.created_at)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text variant="bodyBold" color={colors.primary.amberDark}>
          {formatCents(order.total_cents)}
        </Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: STATUS_COLORS[order.status] },
          ]}
        >
          <Text variant="tiny" color={colors.white}>
            {STATUS_LABELS[order.status]}
          </Text>
        </View>
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
        <ActivityIndicator color={colors.primary.amber} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Orders" />

      <View style={styles.container}>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setStatusFilter(filter.value)}
                style={[styles.chip, isActive && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  variant="captionBold"
                  color={isActive ? colors.white : colors.text.secondary}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonShimmer key={i} width="100%" height={64} borderRadius={12} />
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
                title="No orders yet"
                message={
                  statusFilter
                    ? `No orders are currently ${statusFilter}.`
                    : 'Orders placed by parents will appear here for fulfilment.'
                }
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary.amber}
                colors={[colors.primary.amber]}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 9999,
    backgroundColor: colors.background.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  chipActive: {
    backgroundColor: colors.primary.amber,
    borderColor: colors.primary.amber,
  },
  skeletonList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  rowPressed: {
    backgroundColor: colors.gray[100],
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: layout.cardRadius,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
