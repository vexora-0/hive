/**
 * The single source of truth for orderable products.
 *
 * Three layers previously disagreed: the mobile cart used `print_4x6` with
 * dollar prices, this validator used `4x6` with cent prices, and the database
 * CHECK constraint allowed only the `print_*` set. Every order failed Zod
 * validation before reaching the database — the feature had never worked.
 *
 * Values match the order_items.product_type CHECK constraint. Prices are
 * INTEGER CENTS; never store or compute money as a float.
 *
 * Mirrored in apps/mobile/src/features/orders/constants/products.ts. Test
 * T-19b asserts the two agree.
 */
export const PRODUCT_TYPES = [
  'print_4x6',
  'print_5x7',
  'print_8x10',
  'digital_download',
  'photo_book',
  'magnet',
  'mug',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_PRICES_CENTS: Record<ProductType, number> = {
  print_4x6: 499,
  print_5x7: 799,
  print_8x10: 1299,
  digital_download: 299,
  photo_book: 2999,
  magnet: 999,
  mug: 1499,
};

export const PRODUCT_LABELS: Record<ProductType, string> = {
  print_4x6: '4x6 Print',
  print_5x7: '5x7 Print',
  print_8x10: '8x10 Print',
  digital_download: 'Digital Download',
  photo_book: 'Photo Book',
  magnet: 'Magnet',
  mug: 'Mug',
};
