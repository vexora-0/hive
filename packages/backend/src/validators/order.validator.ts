import { PRODUCT_TYPES } from '../constants/products';
import { z } from 'zod';



export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        photoId: z.string().uuid('photoId must be a valid UUID'),
        productType: z.enum(PRODUCT_TYPES, {
          errorMap: () => ({
            message: `productType must be one of: ${PRODUCT_TYPES.join(', ')}`,
          }),
        }),
        quantity: z
          .number()
          .int()
          .min(1, 'quantity must be at least 1')
          .max(99, 'quantity must not exceed 99'),
      }),
    )
    .min(1, 'At least one item is required'),
  shippingAddress: z
    .string()
    .min(1, 'shippingAddress is required')
    .max(500, 'shippingAddress too long'),
  notes: z.string().max(1000, 'notes too long').optional(),
});

export const getOrdersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must not exceed 50')
    .default(20),
});

/**
 * The order statuses, in the order the `orders.status` CHECK constraint
 * (migration 00009) declares them.
 *
 * 'pending' is excluded from what an admin may set: it is the state an order
 * is born in and nothing should be able to move it back there. The legal
 * transitions themselves live in order.service — a schema can say the value is
 * a status, not that it is a *reachable* one from where the order is now.
 */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], {
    errorMap: () => ({
      message:
        'status must be one of: confirmed, processing, shipped, delivered, cancelled',
    }),
  }),
});

/**
 * Query for the admin order list. Mirrors `getOrdersSchema` and adds an
 * optional status filter, which is the first thing anyone fulfilling orders
 * wants ("show me what is still pending").
 */
export const getSchoolOrdersSchema = z.object({
  cursor: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  // Only consulted for a platform admin, who has no school of their own.
  // It must be declared here or `validate` strips it: the middleware replaces
  // req.query with the parsed object.
  schoolId: z.string().uuid('schoolId must be a valid UUID').optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must not exceed 50')
    .default(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type GetOrdersInput = z.infer<typeof getOrdersSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type GetSchoolOrdersInput = z.infer<typeof getSchoolOrdersSchema>;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
