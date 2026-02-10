-- =============================================================================
-- Migration: 00009_create_orders
-- Description: Create orders and order_items tables for photo print purchases
-- =============================================================================

CREATE TABLE orders (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id         uuid           NOT NULL REFERENCES profiles ON DELETE CASCADE,
    school_id         uuid           NOT NULL REFERENCES schools ON DELETE CASCADE,
    idempotency_key   text           UNIQUE NOT NULL,
    status            text           NOT NULL DEFAULT 'pending'
                                     CHECK (status IN (
                                         'pending',
                                         'confirmed',
                                         'processing',
                                         'shipped',
                                         'delivered',
                                         'cancelled'
                                     )),
    total_amount      decimal(10,2)  NOT NULL DEFAULT 0,
    shipping_address  text,
    notes             text,
    created_at        timestamptz    NOT NULL DEFAULT now(),
    updated_at        timestamptz    NOT NULL DEFAULT now()
);

-- All orders for a parent
CREATE INDEX idx_orders_parent_id ON orders (parent_id, created_at DESC);

-- Idempotency key lookup (UNIQUE already creates an index, but naming it explicitly)
-- The UNIQUE constraint on idempotency_key already provides an index.

COMMENT ON TABLE orders IS 'Photo print and merchandise orders placed by parents';
COMMENT ON COLUMN orders.idempotency_key IS 'Client-generated key to prevent duplicate order submissions';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount in USD';

-- ---------------------------------------------------------------------------

CREATE TABLE order_items (
    id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      uuid           NOT NULL REFERENCES orders ON DELETE CASCADE,
    photo_id      uuid           NOT NULL REFERENCES photos ON DELETE SET NULL,
    product_type  text           NOT NULL
                                 CHECK (product_type IN (
                                     'print_4x6',
                                     'print_5x7',
                                     'print_8x10',
                                     'digital_download',
                                     'photo_book',
                                     'magnet',
                                     'mug'
                                 )),
    quantity      int            NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price    decimal(10,2)  NOT NULL CHECK (unit_price >= 0),
    created_at    timestamptz    NOT NULL DEFAULT now()
);

-- All items in an order
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

COMMENT ON TABLE order_items IS 'Individual line items within a parent order';
COMMENT ON COLUMN order_items.product_type IS 'Type of physical or digital product';
