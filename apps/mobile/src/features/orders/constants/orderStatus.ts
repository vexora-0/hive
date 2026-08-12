import { colors } from '@/theme';
import type { BadgeVariant } from '@/components/ui';
import type { OrderStatus } from '@/types/supabase';

/**
 * How an order status is named and coloured, in one place.
 *
 * Four screens each carried their own copy of this map — the parent's order
 * list, the order detail sheet, the admin order list and the admin status
 * sheet — and they had already drifted: the same order read "Processing" in
 * plum on one screen and "Processing" in grey on another. A parent and an
 * administrator looking at the same order should see the same word in the same
 * colour.
 *
 * Labels are sentence case and describe what is happening to the order, from
 * the customer's side, not the row's internal state.
 */
export interface OrderStatusConfig {
  label: string;
  /** Badge variant used wherever the status appears as a pill. */
  variant: BadgeVariant;
  /** The status's own hue, for dots, rails and progress marks. */
  tint: string;
  /** What the status means, for the detail sheet. */
  description: string;
}

export const ORDER_STATUS: Record<OrderStatus, OrderStatusConfig> = {
  pending: {
    label: 'Placed',
    variant: 'warning',
    tint: colors.warning.main,
    description: "We've got your order and the school is reviewing it.",
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'info',
    tint: colors.primary.blue,
    description: 'Your order is confirmed and queued for printing.',
  },
  processing: {
    label: 'Printing',
    variant: 'info',
    tint: colors.primary.lavender,
    description: 'Your prints are being made.',
  },
  shipped: {
    label: 'On the way',
    variant: 'info',
    tint: colors.primary.blueDark,
    description: 'Your order has left the printer and is on its way.',
  },
  delivered: {
    label: 'Delivered',
    variant: 'success',
    tint: colors.success.main,
    description: 'Delivered. We hope you like them.',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'error',
    tint: colors.error.main,
    description: 'This order was cancelled. You have not been charged.',
  },
};

/**
 * The happy path, in order. Used to draw progress; `cancelled` is deliberately
 * absent because it is an exit from the sequence, not a step in it.
 */
export const ORDER_PROGRESSION: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

/** How far along the happy path a status is, or -1 for `cancelled`. */
export function orderProgressIndex(status: OrderStatus): number {
  return ORDER_PROGRESSION.indexOf(status);
}
