/**
 * The single source of truth for orderable products.
 *
 * Three layers previously disagreed: the mobile cart used `print_4x6` with
 * dollar prices, this validator used `4x6` with cent prices, and the database
 * CHECK constraint allowed only the `print_*` set. Every order failed Zod
 * validation before reaching the database — the feature had never worked.
 *
 * Values match the order_items.product_type CHECK constraint.
 *
 * **Money is INTEGER PAISE.** Never store or compute money as a float. The
 * database columns are still named `total_cents` and `unit_price_cents`: they
 * hold whatever the minor unit of the current currency is, and renaming them
 * would mean a migration, a regenerated `supabase.ts` and a sweep through
 * every service for no behavioural gain. The name is historical, like
 * `photos.s3_key` holding a Supabase Storage path.
 *
 * Prices are set for the Indian market — a 4×6 print at ₹30 is what a local
 * lab charges, and a parent ordering a term's worth of prints should land
 * somewhere they recognise.
 *
 * Mirrored in apps/mobile/src/features/orders/constants/products.ts. The two
 * files must agree; the mobile copy adds the display formatter.
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

/** Unit prices in INTEGER PAISE. ₹1 = 100 paise. */
export const PRODUCT_PRICES_PAISE: Record<ProductType, number> = {
  print_4x6: 3000, // ₹30
  print_5x7: 5000, // ₹50
  print_8x10: 9900, // ₹99
  digital_download: 2000, // ₹20
  photo_book: 49900, // ₹499
  magnet: 14900, // ₹149
  mug: 29900, // ₹299
};

export const PRODUCT_LABELS: Record<ProductType, string> = {
  print_4x6: '4×6 print',
  print_5x7: '5×7 print',
  print_8x10: '8×10 print',
  digital_download: 'Digital copy',
  photo_book: 'Photo book',
  magnet: 'Fridge magnet',
  mug: 'Photo mug',
};
