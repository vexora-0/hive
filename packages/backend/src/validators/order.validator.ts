import { z } from 'zod';

export const productTypes = [
  '4x6',
  '5x7',
  '8x10',
  '11x14',
  '16x20',
  'digital',
  'photo_book',
  'magnet',
  'mug',
  'canvas',
] as const;

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        photoId: z.string().uuid('photoId must be a valid UUID'),
        productType: z.enum(productTypes, {
          errorMap: () => ({
            message: `productType must be one of: ${productTypes.join(', ')}`,
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
