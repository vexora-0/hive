import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text, Badge, Button, Divider } from '@/components/ui';
import { BottomSheet, ConfirmDialog } from '@/components/feedback';
import { formatRupees } from '@/features/orders/constants/products';
import { ORDER_STATUS } from '@/features/orders/constants/orderStatus';
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

/**
 * Labels come from the shared catalogue so the word an administrator picks is
 * the word the parent then reads in their own order list.
 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: ORDER_STATUS.pending.label,
  confirmed: ORDER_STATUS.confirmed.label,
  processing: ORDER_STATUS.processing.label,
  shipped: ORDER_STATUS.shipped.label,
  delivered: ORDER_STATUS.delivered.label,
  cancelled: ORDER_STATUS.cancelled.label,
};

// ---------------------------------------------------------------------------
// Reading an order as a person
//
// `AdminOrder` carries `parent_id` and no name: the fulfilment endpoint selects
// eight columns from `orders` and joins nothing, so there is no parent to lead
// the row with and no way to add one from the presentation layer. The closest
// human fact the payload holds is the delivery address, whose first line is
// where the prints are actually going — so that is what a row leads with, and
// the order number goes where an order number belongs, in the quiet line
// underneath. Recorded as a data gap rather than papered over.
// ---------------------------------------------------------------------------

/** The first line of the delivery address — a household, not an identifier. */
export function orderRecipient(order: AdminOrder): string {
  const first = order.shipping_address?.split(/[\n,]/)[0]?.trim();
  return first && first.length > 0 ? first : 'No delivery address';
}

/** "Placed today", "Placed 3 days ago", "Placed on 12 August". Never a stamp. */
export function orderPlaced(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);

  if (Number.isNaN(days)) return 'Placed recently';
  if (days <= 0) return 'Placed today';
  if (days === 1) return 'Placed yesterday';
  if (days < 14) return `Placed ${days} days ago`;

  return `Placed on ${then.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  })}`;
}

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
 * `<OrderStatusSheet>` — moves one order to its next step.
 *
 * Only legal next statuses are offered, so an admin cannot walk an order
 * backwards, and the two kinds of "next" are no longer drawn the same. Every
 * status but one has a single expected step — placed becomes confirmed,
 * confirmed goes to print — so that step is the sheet's pinned button and the
 * admin can move a queue with their thumb. Cancelling is the exception: it is
 * quiet, it sits below a rule, and it is the one transition here that still
 * asks first, because it is the one a parent cannot undo.
 */
export function OrderStatusSheet({
  order,
  onClose,
  onSelect,
  isUpdating = false,
}: OrderStatusSheetProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const options = order ? NEXT_STATUSES[order.status] : [];
  const advance = options.find((next) => next !== 'cancelled');
  const canCancel = options.includes('cancelled');

  const handleAdvance = useCallback(() => {
    if (!order || !advance) return;
    onSelect(order, advance);
    onClose();
  }, [order, advance, onSelect, onClose]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmingCancel(false);
    if (order) onSelect(order, 'cancelled');
    onClose();
  }, [order, onSelect, onClose]);

  const status = order ? ORDER_STATUS[order.status] : null;

  return (
    <BottomSheet
      visible={order !== null}
      onClose={onClose}
      title={order ? orderRecipient(order) : ''}
      subtitle={
        order
          ? `${formatRupees(order.total_cents)} · ${orderPlaced(order.created_at)} · #${formatOrderNumber(order.id)}`
          : undefined
      }
      footer={
        advance ? (
          <Button
            fullWidth
            onPress={handleAdvance}
            loading={isUpdating}
            accessibilityHint="The parent is told about every step"
          >
            {`Mark as ${STATUS_LABELS[advance].toLowerCase()}`}
          </Button>
        ) : undefined
      }
    >
      {order && status && (
        <>
          <View style={styles.currently}>
            <Text variant="bodySmall" muted>
              Currently
            </Text>
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </View>

          {order.notes ? (
            <Text variant="bodySmall" muted style={styles.notes}>
              “{order.notes}”
            </Text>
          ) : null}

          {options.length === 0 && (
            <Text variant="body" muted style={styles.terminal}>
              This order is {STATUS_LABELS[order.status].toLowerCase()} and can no
              longer change.
            </Text>
          )}

          {canCancel && (
            <>
              <Divider style={styles.rule} />

              <Pressable
                onPress={() => setConfirmingCancel(true)}
                disabled={isUpdating}
                style={({ pressed }) => [
                  styles.cancelRow,
                  pressed && styles.cancelRowPressed,
                  isUpdating && styles.cancelRowDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancel this order"
                accessibilityHint="The parent is notified. This cannot be undone."
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={colors.error.main}
                />
                <Text variant="body" color={colors.error.main}>
                  Cancel this order
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {/* Nested inside the sheet, not a sibling of it — a sibling Modal never
          appears on iOS. See the note in ParentListSheet. */}
      <ConfirmDialog
        visible={confirmingCancel}
        title="Cancel this order?"
        message="The parent will be told, and no prints will be made. This cannot be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep it"
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  currently: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  notes: {
    marginTop: spacing.ms,
  },
  terminal: {
    paddingVertical: spacing.md,
  },
  rule: {
    marginVertical: spacing.ms,
  },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  cancelRowPressed: {
    backgroundColor: colors.error.background,
  },
  cancelRowDisabled: {
    opacity: 0.55,
  },
});

export { STATUS_LABELS, NEXT_STATUSES };
export default OrderStatusSheet;
