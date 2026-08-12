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
 * hold whatever the minor unit of the current currency is, and the name is
 * historical, like `photos.s3_key` holding a Supabase Storage path.
 *
 * Mirrored from packages/backend/src/constants/products.ts — keep in sync.
 * This copy adds `formatRupees`, the only place money becomes a string.
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

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * Groups a whole number of rupees the Indian way: the last three digits, then
 * pairs. 1234567 becomes 12,34,567, not 1,234,567.
 *
 * Hand-rolled rather than `Intl.NumberFormat('en-IN')` because Hermes ships
 * without full ICU on Android unless the build opts in, and a total silently
 * falling back to Western grouping on one platform is the kind of bug nobody
 * files.
 */
function groupIndian(rupees: number): string {
  const digits = String(rupees);
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

/**
 * Formats integer paise for display. The only place money becomes a string.
 *
 * Whole rupees are shown without a decimal — ₹499, not ₹499.00 — because every
 * price in the catalogue is whole and trailing zeroes just add noise. Paise
 * appear only when there are any, which today means never, but a discount or a
 * tax line would produce them.
 *
 * ```ts
 * formatRupees(49900);  // '₹499'
 * formatRupees(4950);   // '₹49.50'
 * formatRupees(1234567) // '₹12,345.67'
 * ```
 */
export function formatRupees(paise: number): string {
  const rounded = Math.round(paise);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);

  const rupees = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  const fraction = remainder === 0 ? '' : `.${String(remainder).padStart(2, '0')}`;

  return `${sign}₹${groupIndian(rupees)}${fraction}`;
}
