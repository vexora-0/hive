import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/feedback';
import { formatCents } from '@/features/orders/constants/products';
import { formatOrderNumber } from '@/features/orders/utils/orderNumber';
import type { OrderStatus } from '@/types/supabase';
import type { AdminOrder } from '../services/adminService';

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * Which statuses an order may move to next.
 *
 * Mirrored from `ALLOWED_STATUS_TRANSITIONS` in
 * packages/backend/src/services/order.service.ts — keep in sync, the same way
 * the product catalogue is mirrored in features/orders/constants/products.ts.
 *
 * The server is the authority: this map only decides which buttons to render,
 * and an illegal transition is rejected there with a 400 regardless.
 */
const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  confirmed: 'checkmark-circle-outline',
  processing: 'construct-outline',
  shipped: 'airplane-outline',
  delivered: 'gift-outline',
  cancelled: 'close-circle-outline',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderStatusSheetProps {
  /** The order to act on. `null` hides the sheet. */
  order: AdminOrder | null;
  onClose: () => void;
  onSelect: (order: AdminOrder, next: OrderStatus) => void;
  isUpdating?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OrderStatusSheet>` — moves one order to its next fulfilment status.
 *
 * Only legal next statuses are offered, so an admin cannot walk an order
 * backwards. Cancelling is confirmed separately: it is the one transition
 * here that a parent cannot undo.
 */
export function OrderStatusSheet({
  order,
  onClose,
  onSelect,
  isUpdating = false,
}: OrderStatusSheetProps) {
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);

  const options = order ? NEXT_STATUSES[order.status] : [];

  const handlePress = (next: OrderStatus) => {
    if (!order) return;
    if (next === 'cancelled') {
      setConfirmingCancel(true);
      return;
    }
    onSelect(order, next);
    onClose();
  };

  const handleConfirmCancel = () => {
    setConfirmingCancel(false);
    if (order) onSelect(order, 'cancelled');
    onClose();
  };

  return (
    <Modal
      visible={order !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleIndicator} />
          <View style={styles.content}>
            {order && (
              <>
                <Text variant="h3">Order #{formatOrderNumber(order.id)}</Text>
                <Text
                  variant="bodySmall"
                  color={colors.text.secondary}
                  style={styles.subtitle}
                >
                  {formatCents(order.total_cents)} · currently{' '}
                  {STATUS_LABELS[order.status]}
                </Text>

                {options.length === 0 ? (
                  <Text
                    variant="bodySmall"
                    color={colors.text.tertiary}
                    style={styles.terminal}
                  >
                    This order is {STATUS_LABELS[order.status].toLowerCase()} and
                    can no longer change.
                  </Text>
                ) : (
                  options.map((next) => (
                    <Pressable
                      key={next}
                      onPress={() => handlePress(next)}
                      disabled={isUpdating}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.actionRowPressed,
                        isUpdating && styles.actionRowDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark as ${STATUS_LABELS[next]}`}
                    >
                      <Ionicons
                        name={STATUS_ICONS[next]}
                        size={22}
                        color={
                          next === 'cancelled'
                            ? colors.error.main
                            : colors.text.primary
                        }
                        style={styles.actionIcon}
                      />
                      <Text
                        variant="body"
                        color={
                          next === 'cancelled'
                            ? colors.error.main
                            : colors.text.primary
                        }
                      >
                        Mark as {STATUS_LABELS[next]}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            )}

            {/* Nested inside the sheet — a sibling Modal never shows on iOS. */}
            <ConfirmDialog
              visible={confirmingCancel}
              title="Cancel this order?"
              message="The parent will be notified. This cannot be undone."
              confirmLabel="Cancel Order"
              cancelLabel="Keep Order"
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.lg,
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
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  terminal: {
    paddingVertical: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    borderRadius: layout.cardRadius,
    minHeight: 48,
  },
  actionRowPressed: {
    backgroundColor: colors.gray[100],
  },
  actionRowDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    marginRight: spacing.md,
  },
});

export { STATUS_LABELS, NEXT_STATUSES };
export default OrderStatusSheet;
