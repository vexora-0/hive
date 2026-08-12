import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRupees, PRODUCT_LABELS } from '../constants/products';
import {
  ORDER_STATUS,
  ORDER_PROGRESSION,
  orderProgressIndex,
} from '../constants/orderStatus';
import { formatOrderNumber } from '../utils/orderNumber';
import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { Text, Button, Badge } from '@/components/ui';
import { HiveImage } from '@/components/media';
import type { OrderStatus, ProductType } from '@/types/supabase';

import { useOrderDetail, useCancelOrder } from '../hooks/useOrders';
import { Modal, ConfirmDialog } from '@/components/feedback';

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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getProductLabel(type: ProductType): string {
  return PRODUCT_LABELS[type];
}

function getStatusStepIndex(status: OrderStatus): number {
  return orderProgressIndex(status);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderDetailSheet>` — a bottom sheet showing the full details of an order.
 *
 * Includes an items list with thumbnails, a status timeline/progress indicator,
 * shipping address, notes, and the total amount.
 */
export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const { data: order, isLoading } = useOrderDetail(orderId ?? '');
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
          <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
            Status
          </Text>
          <View style={styles.cancelledBadge}>
            <Ionicons name="close-circle" size={19} color={colors.error.dark} />
            <Text variant="bodySmall" color={colors.error.dark} style={styles.cancelledText}>
              {ORDER_STATUS.cancelled.description}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
          Progress
        </Text>

        {/* What is happening right now, in words, above the rail. A row of
            dots tells a parent which stage is lit; it does not tell them what
            that stage means. */}
        <Text variant="bodyBold" style={styles.timelineHeadline}>
          {ORDER_STATUS[order.status].description}
        </Text>

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

  // ── Items list ───────────────────────────────────────────────────
  const renderItems = () => {
    if (!order?.items?.length) return null;

    return (
      <View style={styles.section}>
        <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
          {order.items.length === 1 ? 'Item' : `${order.items.length} items`}
        </Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {item.thumbnailUrl ? (
              <View style={styles.itemMount}>
                <HiveImage
                  uri={item.thumbnailUrl}
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
              <Text variant="bodySmallBold">
                {getProductLabel(item.product_type)}
              </Text>
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

  // ── Main render ──────────────────────────────────────────────────
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleIndicator} />
          <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.amberDark} />
            <Text variant="bodySmall" muted style={styles.loadingText}>
              Loading your order…
            </Text>
          </View>
        ) : order ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="h2">Your order</Text>
                <Text variant="caption" color={colors.text.tertiary} style={styles.headerMeta}>
                  #{formatOrderNumber(order.id)} · placed {formatDate(order.created_at)}
                </Text>
              </View>
              <Badge variant={ORDER_STATUS[order.status].variant} dot>
                {ORDER_STATUS[order.status].label}
              </Badge>
            </View>

            {/* Status timeline */}
            {renderTimeline()}

            {/* Items */}
            {renderItems()}

            {/* Delivery address */}
            {order.shipping_address && (
              <View style={styles.section}>
                <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
                  Delivering to
                </Text>
                <View style={styles.infoCard}>
                  <Text variant="bodySmall" muted>
                    {order.shipping_address}
                  </Text>
                </View>
              </View>
            )}

            {/* Notes */}
            {order.notes && (
              <View style={styles.section}>
                <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
                  Your note
                </Text>
                <View style={styles.infoCard}>
                  <Text variant="bodySmall" muted>
                    {order.notes}
                  </Text>
                </View>
              </View>
            )}

            {/* Total */}
            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text variant="bodyBold">Total</Text>
                <Text variant="priceLarge">{formatRupees(order.total_cents)}</Text>
              </View>
            </View>

            {canCancel && (
              <Button
                variant="outline"
                fullWidth
                onPress={() => setConfirmingCancel(true)}
                loading={cancelOrder.isPending}
                style={styles.cancelButton}
              >
                Cancel this order
              </Button>
            )}
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text variant="body" color={colors.text.secondary}>
              Order not found.
            </Text>
          </View>
        )}

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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...platformShadow(shadows.xlarge),
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    maxHeight: '100%',
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.border.default,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.ms,
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.ms,
  },
  headerText: {
    flex: 1,
  },
  headerMeta: {
    marginTop: spacing.xs,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
  },

  // Sections
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },

  // Timeline
  timelineHeadline: {
    marginBottom: spacing.md,
  },
  // Horizontal rail: five stages read left to right in the space three read
  // vertically, and the shape matches the step rail in the order sheet.
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
    borderColor: colors.background.cream,
  },
  timelineLine: {
    height: 2,
    flex: 1,
  },
  timelineLabel: {
    marginTop: spacing.sm,
    paddingRight: spacing.xs,
  },

  // Cancelled
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.error.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
    borderRadius: radius.sm,
  },
  cancelledText: {
    flex: 1,
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  itemMount: {
    padding: 4,
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
    gap: 2,
  },

  // Info cards
  infoCard: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },

  // Total
  totalSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cancelButton: {
    marginTop: spacing.lg,
  },
});

export default OrderDetailSheet;
