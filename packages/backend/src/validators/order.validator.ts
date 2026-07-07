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

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type GetOrdersInput = z.infer<typeof getOrdersSchema>;
