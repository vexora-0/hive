-- =============================================================================
-- Migration: 00017_order_totals_cents
-- Description: Store order money as integer cents (G-01).
--
-- total_amount was decimal(10,2) documented as USD, but the service wrote
-- cents into it — a $4.99 print stored as 299.00 and displayed as $299.00.
-- The mobile cart meanwhile priced in dollars. Three layers, three units.
--
-- Integer cents throughout; formatting to dollars happens only at render.
-- =============================================================================

ALTER TABLE orders RENAME COLUMN total_amount TO total_cents;
ALTER TABLE orders
    ALTER COLUMN total_cents TYPE integer USING round(total_cents)::integer,
    ALTER COLUMN total_cents SET DEFAULT 0;

ALTER TABLE order_items RENAME COLUMN unit_price TO unit_price_cents;
ALTER TABLE order_items
    ALTER COLUMN unit_price_cents TYPE integer USING round(unit_price_cents)::integer;

COMMENT ON COLUMN orders.total_cents IS
    'Order total in INTEGER CENTS. Never store money as a float.';
COMMENT ON COLUMN order_items.unit_price_cents IS
    'Unit price in INTEGER CENTS, set server-side from constants/products.ts. '
    'The client never supplies a price.';

-- The product_type CHECK already matches the catalogue; restated so the
-- migration is self-describing and safe to re-run.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_type_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_type_check
    CHECK (product_type IN (
        'print_4x6', 'print_5x7', 'print_8x10',
        'digital_download', 'photo_book', 'magnet', 'mug'
    ));
