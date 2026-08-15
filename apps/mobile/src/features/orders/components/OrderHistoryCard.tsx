import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRupees, PRODUCT_LABELS, type ProductType } from '../constants/products';
import { ORDER_STATUS } from '../constants/orderStatus';
import { formatOrderNumber } from '../utils/orderNumber';
import { colors, spacing, radius, layout } from '@/theme';
import { Text, Card, Badge, Divider } from '@/components/ui';
import { SkeletonShimmer } from '@/components/feedback';
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

/**
 * When the order was placed, said the way a person would say it.
 *
 * "Today" and "Yesterday" for the two days a parent is actually tracking, the
 * weekday for the rest of the week, and a plain date after that — the year only
 * when it is not this one. A machine timestamp tells a parent nothing they
 * cannot work out, and reads like a database export of their own family.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000),
  );

  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo > 1 && daysAgo < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
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
// The same card, before it has anything to say
// ---------------------------------------------------------------------------

/**
 * `<OrderHistoryCardSkeleton>` — the loading shape of the row above.
 *
 * It lives in this file deliberately. The orders screen used to hand-roll its
 * own three-bar placeholder, which drifted until it had a different padding, a
 * different radius and a row the real card did not have — so the list visibly
 * relaid itself the moment the orders arrived. Keeping the skeleton next to the
 * component it stands in for is the only way the two stay honest: it renders
 * the **real** `<Card>`, at the real elevation, with the real margins.
 *
 * `SkeletonShimmer` waits out its own 200ms, so a cached list never flashes.
 */
export function OrderHistoryCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <Card elevation="low" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.headline}>
          <SkeletonShimmer width="62%" height={16} borderRadius={4} index={index} />
          <View style={styles.meta}>
            <SkeletonShimmer width="45%" height={10} borderRadius={4} index={index} />
          </View>
        </View>
        <SkeletonShimmer
          width={78}
          height={22}
          borderRadius={radius.pill}
          index={index}
        />
      </View>

      <Divider style={styles.divider} />

      <View style={styles.bottomRow}>
        <SkeletonShimmer width={84} height={20} borderRadius={4} index={index} />
        <SkeletonShimmer width={62} height={14} borderRadius={4} index={index} />
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
