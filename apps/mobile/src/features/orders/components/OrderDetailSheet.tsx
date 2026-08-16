import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRupees, PRODUCT_LABELS } from '../constants/products';
import {
  ORDER_STATUS,
  ORDER_PROGRESSION,
  orderProgressIndex,
} from '../constants/orderStatus';
import { formatOrderNumber } from '../utils/orderNumber';
import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  fontSize,
  lineHeight,
} from '@/theme';
import { Text, Button, Badge, Divider } from '@/components/ui';
import { HiveImage } from '@/components/media';
import type { OrderStatus, ProductType } from '@/types/supabase';

import { useOrderDetail, useCancelOrder } from '../hooks/useOrders';
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  SkeletonShimmer,
} from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderDetailSheetProps {
  /** The order ID to display. Null = hidden. */
  orderId: string | null;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Status timeline config
// ---------------------------------------------------------------------------

/**
 * The happy path and its colours now come from `constants/orderStatus`, which
 * every screen shares. This file used to keep its own copy, so the same order
 * could read "Processing" here and "Processing" in a different colour in the
 * admin console.
 */
const STATUS_STEPS = ORDER_PROGRESSION.map((key) => ({
  key,
  label: ORDER_STATUS[key].label,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * When the order was placed, said the way a person would say it.
 *
 * It used to read "Tue, 12 Aug 2025, 3:04 pm" — a machine timestamp with
 * commas in it. The minute an order was placed is not a fact a parent needs
 * about their own order; which day it was is.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round(
    (startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000),
  );

  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo > 1 && daysAgo < 7) {
    return `on ${date.toLocaleDateString(undefined, { weekday: 'long' })}`;
  }

  return `on ${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })}`;
}

function getProductLabel(type: ProductType): string {
  return PRODUCT_LABELS[type];
}

function getStatusStepIndex(status: OrderStatus): number {
  return orderProgressIndex(status);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * The order's own shape, before it has arrived.
 *
 * The sheet used to open on a large spinner and a "Loading your order…" line,
 * which is the app telling a parent it is busy rather than showing them where
 * their order is going to be. This is the same rail, the same item row and the
 * same total, with the words missing.
 */
function DetailSkeleton() {
  return (
    <View>
      <View style={styles.section}>
        <SkeletonShimmer width="70%" height={16} borderRadius={4} index={0} />
        <View style={styles.skeletonRail}>
          <SkeletonShimmer width="100%" height={11} borderRadius={6} index={1} />
        </View>
      </View>

      <View style={styles.section}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.itemRow}>
            <SkeletonShimmer
              width={60}
              height={60}
              borderRadius={radius.mount}
              index={i + 2}
            />
            <View style={styles.itemDetails}>
              <SkeletonShimmer width="60%" height={14} borderRadius={4} index={i + 2} />
              <SkeletonShimmer width="35%" height={11} borderRadius={4} index={i + 2} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <SkeletonShimmer width={54} height={16} borderRadius={4} index={4} />
          <SkeletonShimmer width={92} height={26} borderRadius={4} index={4} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderDetailSheet>` — everything known about one order.
 *
 * It is the app's one sheet now: scrim, radius, handle, safe-area inset and
 * height ceiling all belong to `<BottomSheet>` rather than being re-declared
 * here, which is how fourteen sheets ended up with four different maximum
 * heights and two different grounds.
 *
 * The order of the page is the order of a parent's questions: where has it got
 * to, what is in it, where is it going, what did it cost. The order number is
 * last on purpose — nobody looks one up until something has gone wrong.
 */
export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useOrderDetail(orderId ?? '');
  const isVisible = orderId != null;

  // ── Cancelling ───────────────────────────────────────────────────
  // Only offered while the order is still pending; the server refuses any
  // later, because prints may already be in production by then.
  const cancelOrder = useCancelOrder();
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const canCancel = order?.status === 'pending';

  const handleConfirmCancel = useCallback(() => {
    setConfirmingCancel(false);
    if (orderId) cancelOrder.mutate(orderId);
  }, [orderId, cancelOrder]);

  // ── Status timeline ──────────────────────────────────────────────
  const renderTimeline = () => {
    if (!order) return null;

    const currentStepIndex = getStatusStepIndex(order.status);
    const isCancelled = order.status === 'cancelled';

    if (isCancelled) {
      return (
        <View style={styles.section}>
          <View style={styles.cancelledBlock}>
            <Ionicons name="close-circle-outline" size={19} color={colors.error.main} />
            <Text variant="bodySmall" color={colors.error.main} style={styles.cancelledText}>
              {ORDER_STATUS.cancelled.description}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        {/* What is happening right now, in words, above the rail. A row of
            dots tells a parent which stage is lit; it does not tell them what
            that stage means. */}
        <View style={styles.statusHeadline}>
          <Text variant="bodyBold" style={styles.statusText}>
            {ORDER_STATUS[order.status].description}
          </Text>
          <Badge variant={ORDER_STATUS[order.status].variant} dot>
            {ORDER_STATUS[order.status].label}
          </Badge>
        </View>

        <View style={styles.timeline}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isLast = index === STATUS_STEPS.length - 1;

            return (
              <View key={step.key} style={styles.timelineStep}>
                <View style={styles.timelineDotColumn}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: isCompleted
                          ? ORDER_STATUS[step.key].tint
                          : colors.gray[300],
                      },
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  />
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor:
                            index < currentStepIndex
                              ? ORDER_STATUS[step.key].tint
                              : colors.gray[200],
                        },
                      ]}
                    />
                  )}
                </View>
                <Text
                  variant={isCurrent ? 'captionBold' : 'caption'}
                  color={isCompleted ? colors.text.primary : colors.text.tertiary}
                  style={styles.timelineLabel}
                  numberOfLines={2}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Items ────────────────────────────────────────────────────────
  const renderItems = () => {
    if (!order?.items?.length) return null;

    return (
      <View style={styles.section}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {item.thumbnailUrl ? (
              <View style={styles.itemMount}>
                <HiveImage
                  uri={item.thumbnailUrl}
                  recyclingKey={item.id}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              </View>
            ) : (
              // No signed URL — the photo record or its stored object is
              // missing. Keep the slot so the row does not reflow.
              <View style={styles.itemImagePlaceholder}>
                <Ionicons name="image-outline" size={20} color={colors.text.tertiary} />
              </View>
            )}
            <View style={styles.itemDetails}>
              <Text variant="bodySmallBold">{getProductLabel(item.product_type)}</Text>
              <Text variant="caption" color={colors.text.tertiary}>
                {item.quantity} × {formatRupees(item.unit_price_cents)}
              </Text>
            </View>
            <Text variant="bodySmallBold">
              {formatRupees(item.quantity * item.unit_price_cents)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Body ─────────────────────────────────────────────────────────
  const body = () => {
    if (isLoading) return <DetailSkeleton />;

    // A failed request must never be dressed up as an order that has nothing
    // in it. "Order not found." was shown for a dropped connection too.
    if (isError || !order) {
      return (
        <EmptyState
          variant="error"
          title="Couldn't load this order."
          message="It may just be the connection. Try again in a moment."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      );
    }

    return (
      <>
        {renderTimeline()}
        {renderItems()}

        {order.shipping_address && (
          <View style={styles.section}>
            <Text variant="bodySmallBold" style={styles.sectionTitle}>
              Delivering to
            </Text>
            <View style={styles.infoCard}>
              <Text variant="bodySmall" muted>
                {order.shipping_address}
              </Text>
            </View>
          </View>
        )}

        {order.notes && (
          <View style={styles.section}>
            <Text variant="bodySmallBold" style={styles.sectionTitle}>
              Your note
            </Text>
            <View style={styles.infoCard}>
              <Text variant="bodySmall" muted>
                {order.notes}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text variant="bodySmall" muted>
              Delivery
            </Text>
            <Text variant="bodySmall" muted>
              Included
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.totalRow}>
            <Text variant="bodyBold">Total</Text>
            <Text variant="priceLarge">{formatRupees(order.total_cents)}</Text>
          </View>
        </View>

        <Text variant="caption" color={colors.text.tertiary} style={styles.orderNumber}>
          Order #{formatOrderNumber(order.id)}
        </Text>

        {/* Nested inside the sheet on purpose — a ConfirmDialog rendered as a
            sibling Modal never appears on iOS. */}
        <ConfirmDialog
          visible={confirmingCancel}
          title="Cancel this order?"
          message="It will not be printed or delivered. You can order again at any time."
          confirmLabel="Cancel order"
          cancelLabel="Keep it"
          destructive
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirmingCancel(false)}
        />
      </>
    );
  };

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title="Your order"
      subtitle={order ? `Placed ${formatDate(order.created_at)}` : undefined}
      showClose
      scroll
      footer={
        canCancel ? (
          <Button
            variant="outline"
            fullWidth
            onPress={() => setConfirmingCancel(true)}
            loading={cancelOrder.isPending}
          >
            Cancel this order
          </Button>
        ) : undefined
      }
    >
      {body()}
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ── Sections ──
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },

  // ── Status ──
  statusHeadline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.ms,
    marginBottom: spacing.md,
  },
  statusText: {
    flex: 1,
  },

  // Horizontal rail: five stages read left to right in the space three read
  // vertically, and the shape matches the recap in the order sheet.
  timeline: {
    flexDirection: 'row',
  },
  timelineStep: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timelineDotColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 16,
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  timelineDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3.5,
    borderColor: colors.surface.raised,
  },
  timelineLine: {
    height: 2,
    flex: 1,
  },
  timelineLabel: {
    marginTop: spacing.sm,
    // No right padding, and the smallest size in the scale.
    //
    // Five steps split the row five ways, so each label gets about a fifth of
    // the sheet's width. At `caption` that fits "Printing" and not "Confirmed",
    // and a single word wider than its column cannot wrap at a space — React
    // Native breaks it mid-character instead. On a device the timeline read
    // "Confirme / d" and "On the / way". `tiny` is 10pt against caption's 12,
    // which is enough for the longest label here, and the step's own weight and
    // colour still carry the emphasis.
    fontSize: fontSize.tiny,
    lineHeight: lineHeight.tiny,
  },

  // ── Cancelled ──
  cancelledBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.error.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
    borderRadius: radius.lg,
  },
  cancelledText: {
    flex: 1,
  },

  // ── Items ──
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  itemMount: {
    padding: spacing.xs,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surface,
    ...platformShadow(shadows.small),
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: radius.print,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: radius.mount,
    backgroundColor: colors.background.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
    gap: spacing.xxs,
  },

  // ── Info cards ──
  infoCard: {
    backgroundColor: colors.background.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },

  // ── Money ──
  totalSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    marginVertical: spacing.sm,
  },
  orderNumber: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  // ── Loading ──
  skeletonRail: {
    marginTop: spacing.md,
  },
});

export default OrderDetailSheet;
