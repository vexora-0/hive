import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui';
import { HiveImage } from '@/components/media';
import type { OrderStatus, ProductType } from '@/types/supabase';

import { useOrderDetail } from '../hooks/useOrders';

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

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: colors.primary.amber,
  confirmed: colors.primary.blue,
  processing: colors.primary.lavender,
  shipped: colors.primary.mint,
  delivered: colors.success.main,
  cancelled: colors.error.main,
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getProductLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    print_4x6: '4x6 Print',
    print_5x7: '5x7 Print',
    print_8x10: '8x10 Print',
    digital_download: 'Digital Download',
    photo_book: 'Photo Book',
    magnet: 'Magnet',
    mug: 'Mug',
  };
  return labels[type];
}

function getStatusStepIndex(status: OrderStatus): number {
  if (status === 'cancelled') return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
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

  // ── Status timeline ──────────────────────────────────────────────
  const renderTimeline = () => {
    if (!order) return null;

    const currentStepIndex = getStatusStepIndex(order.status);
    const isCancelled = order.status === 'cancelled';

    if (isCancelled) {
      return (
        <View style={styles.section}>
          <Text variant="bodyBold" style={styles.sectionTitle}>
            Status
          </Text>
          <View style={[styles.cancelledBadge]}>
            <Text variant="bodyBold" color={colors.error.dark}>
              Order Cancelled
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text variant="bodyBold" style={styles.sectionTitle}>
          Order Status
        </Text>
        <View style={styles.timeline}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isLast = index === STATUS_STEPS.length - 1;
            const dotColor = isCompleted
              ? STATUS_COLORS[step.key]
              : colors.gray[300];

            return (
              <View key={step.key} style={styles.timelineStep}>
                <View style={styles.timelineDotColumn}>
                  {/* Dot */}
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: dotColor },
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  />
                  {/* Line */}
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        {
                          backgroundColor: isCompleted && index < currentStepIndex
                            ? STATUS_COLORS[step.key]
                            : colors.gray[200],
                        },
                      ]}
                    />
                  )}
                </View>
                <Text
                  variant={isCurrent ? 'bodySmallBold' : 'bodySmall'}
                  color={isCompleted ? colors.text.primary : colors.text.tertiary}
                  style={styles.timelineLabel}
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
        <Text variant="bodyBold" style={styles.sectionTitle}>
          Items
        </Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemImagePlaceholder}>
              <Text variant="caption" color={colors.text.tertiary} center>
                Photo
              </Text>
            </View>
            <View style={styles.itemDetails}>
              <Text variant="bodySmallBold">
                {getProductLabel(item.product_type)}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Qty: {item.quantity} x {formatPrice(item.unit_price)}
              </Text>
            </View>
            <Text variant="bodySmallBold">
              {formatPrice(item.quantity * item.unit_price)}
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
            <ActivityIndicator size="large" color={colors.primary.amber} />
            <Text
              variant="bodySmall"
              color={colors.text.secondary}
              style={styles.loadingText}
            >
              Loading order details...
            </Text>
          </View>
        ) : order ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text variant="h3">Order Details</Text>
              <Text variant="caption" color={colors.text.secondary}>
                #{order.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            <Text variant="bodySmall" color={colors.text.secondary}>
              Placed on {formatDate(order.created_at)}
            </Text>

            {/* Status timeline */}
            {renderTimeline()}

            {/* Items */}
            {renderItems()}

            {/* Shipping address */}
            {order.shipping_address && (
              <View style={styles.section}>
                <Text variant="bodyBold" style={styles.sectionTitle}>
                  Shipping Address
                </Text>
                <View style={styles.infoCard}>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    {order.shipping_address}
                  </Text>
                </View>
              </View>
            )}

            {/* Notes */}
            {order.notes && (
              <View style={styles.section}>
                <Text variant="bodyBold" style={styles.sectionTitle}>
                  Notes
                </Text>
                <View style={styles.infoCard}>
                  <Text variant="bodySmall" color={colors.text.secondary}>
                    {order.notes}
                  </Text>
                </View>
              </View>
            )}

            {/* Total */}
            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text variant="bodyBold">Total Amount</Text>
                <Text variant="h3" color={colors.primary.amberDark}>
                  {formatPrice(order.total_amount)}
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text variant="body" color={colors.text.secondary}>
              Order not found.
            </Text>
          </View>
        )}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    maxHeight: '100%',
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.gray[300],
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
  timeline: {
    paddingLeft: spacing.xs,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 40,
  },
  timelineDotColumn: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.background.cream,
    // Outer ring effect
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  timelineLabel: {
    marginLeft: spacing.sm,
    paddingTop: 0,
  },

  // Cancelled
  cancelledBadge: {
    backgroundColor: colors.error.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: layout.cardRadius,
    alignSelf: 'flex-start',
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.gray[100],
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
    borderRadius: layout.cardRadius,
    padding: spacing.md,
  },

  // Total
  totalSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.background.surface,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default OrderDetailSheet;
