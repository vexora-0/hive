import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, layout } from '@/theme';
import { Text, Card, Badge, type BadgeVariant } from '@/components/ui';
import type { OrderStatus } from '@/types/supabase';
import type { OrderWithItems } from '../services/orderService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderHistoryCardProps {
  /** The order data to display. */
  order: OrderWithItems;
  /** Called when the card is tapped. */
  onPress: (orderId: string) => void;
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  color: string;
  backgroundColor: string;
}

const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    variant: 'warning',
    color: colors.primary.amberDark,
    backgroundColor: colors.primary.amber + '1F',
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'default',
    color: colors.primary.blueDark,
    backgroundColor: colors.primary.blue + '1F',
  },
  processing: {
    label: 'Processing',
    variant: 'default',
    color: colors.primary.lavenderDark,
    backgroundColor: colors.primary.lavender + '1F',
  },
  shipped: {
    label: 'Shipped',
    variant: 'default',
    color: colors.primary.mintDark,
    backgroundColor: colors.primary.mint + '1F',
  },
  delivered: {
    label: 'Delivered',
    variant: 'success',
    color: colors.success.dark,
    backgroundColor: colors.success.background,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'error',
    color: colors.error.dark,
    backgroundColor: colors.error.background,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncateId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderHistoryCard>` — a card showing a summary of a past order.
 *
 * Displays the (truncated) order ID, date, item count, total amount,
 * and a colored status badge.
 */
export function OrderHistoryCard({ order, onPress }: OrderHistoryCardProps) {
  const statusConfig = STATUS_MAP[order.status];
  const itemCount = order.items?.length ?? 0;

  return (
    <Card onPress={() => onPress(order.id)} style={styles.card}>
      {/* Top row: order ID + status */}
      <View style={styles.topRow}>
        <Text variant="captionBold" color={colors.text.secondary}>
          #{truncateId(order.id)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusConfig.backgroundColor },
          ]}
        >
          <Text variant="captionBold" color={statusConfig.color}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Middle row: date + item count */}
      <View style={styles.middleRow}>
        <Text variant="bodySmall" color={colors.text.secondary}>
          {formatDate(order.created_at)}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {/* Bottom row: total */}
      <View style={styles.bottomRow}>
        <Text variant="body" color={colors.text.secondary}>
          Total
        </Text>
        <Text variant="bodyBold" color={colors.text.primary}>
          {formatPrice(order.total_amount)}
        </Text>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 9999,
  },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});

export default OrderHistoryCard;
