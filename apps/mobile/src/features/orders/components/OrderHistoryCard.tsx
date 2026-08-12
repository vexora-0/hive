import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRupees, PRODUCT_LABELS, type ProductType } from '../constants/products';
import { ORDER_STATUS } from '../constants/orderStatus';
import { formatOrderNumber } from '../utils/orderNumber';
import { colors, spacing, layout } from '@/theme';
import { Text, Card, Badge, Divider } from '@/components/ui';
import type { OrderWithItems } from '../services/orderService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderHistoryCardProps {
  /** The order to display. */
  order: OrderWithItems;
  /** Called when the card is tapped. */
  onPress: (orderId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Names what is actually in the order rather than counting rows: "2 × 4×6
 * print" tells a parent what turns up at the door; "2 items" does not.
 */
function describeItems(order: OrderWithItems): string {
  const items = order.items ?? [];
  if (items.length === 0) return 'No items';

  const first = items[0];
  const label = PRODUCT_LABELS[first.product_type as ProductType] ?? 'Item';
  const firstLine = first.quantity > 1 ? `${first.quantity} × ${label}` : label;

  if (items.length === 1) return firstLine;
  return `${firstLine} + ${items.length - 1} more`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderHistoryCard>` — one row of the parent's order history.
 *
 * The two things a parent wants at a glance are what they ordered and where it
 * has got to, so those get the top line and the badge; the order number is the
 * quiet part, because nobody looks it up until something has gone wrong.
 */
export function OrderHistoryCard({ order, onPress }: OrderHistoryCardProps) {
  const status = ORDER_STATUS[order.status];

  return (
    <Card
      onPress={() => onPress(order.id)}
      elevation="low"
      accessibilityLabel={`Order ${formatOrderNumber(order.id)}, ${status.label}, ${formatRupees(order.total_cents)}`}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.headline}>
          <Text variant="bodyBold" numberOfLines={1}>
            {describeItems(order)}
          </Text>
          <Text variant="caption" color={colors.text.tertiary} style={styles.meta}>
            {formatDate(order.created_at)} · #{formatOrderNumber(order.id)}
          </Text>
        </View>

        <Badge variant={status.variant} dot>
          {status.label}
        </Badge>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.bottomRow}>
        <Text variant="price">{formatRupees(order.total_cents)}</Text>
        <View style={styles.detailsHint}>
          <Text variant="bodySmallBold" color={colors.text.accent}>
            Details
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text.accent} />
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.ms,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.ms,
  },
  headline: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.xs,
  },
  divider: {
    marginVertical: spacing.ms,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});

export default OrderHistoryCard;
