-- 00018 — Order integrity: honest foreign keys, and atomic order creation
--
-- Plan 02, Steps 7 and 8. Closes G-19 and G-37.
--
-- NOTE ON SCOPE: this file carries two related changes, both about an order
-- staying internally consistent. Plan 02 reserves 00017-00019; 00017 was used
-- for the money conversion and 00020 belongs to Plan 03, so both land here
-- rather than claiming a number from someone else's range. Plan 02 Step 8
-- explicitly allows this.
--
-- ---------------------------------------------------------------------------
-- Part 1 — Foreign keys that could never fire (G-19)
-- ---------------------------------------------------------------------------
--
-- Three columns were declared NOT NULL *and* ON DELETE SET NULL. Those are
-- mutually exclusive: deleting the referenced row makes Postgres try to write
-- NULL into a NOT NULL column, which raises a not-null violation instead of
-- nulling the column. The practical effect is that **deleting any profile or
-- photo is impossible today** — the delete fails with a confusing error rather
-- than the intended cascade.
--
-- RESTRICT is the honest expression of what these columns mean:
--   * you should not delete a teacher who still has photos without deciding
--     what happens to the photos;
--   * an order line must always point at a real photo, or the order history
--     becomes unauditable.
--
-- RESTRICT makes that an explicit, immediate error at the point of deletion
-- rather than a surprise.

ALTER TABLE photos
    DROP CONSTRAINT IF EXISTS photos_uploaded_by_fkey;

ALTER TABLE photos
    ADD CONSTRAINT photos_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles (id) ON DELETE RESTRICT;

ALTER TABLE photo_student_tags
    DROP CONSTRAINT IF EXISTS photo_student_tags_tagged_by_fkey;

ALTER TABLE photo_student_tags
    ADD CONSTRAINT photo_student_tags_tagged_by_fkey
    FOREIGN KEY (tagged_by) REFERENCES profiles (id) ON DELETE RESTRICT;

ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_photo_id_fkey;

ALTER TABLE order_items
    ADD CONSTRAINT order_items_photo_id_fkey
    FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Part 2 — Create an order and its items in one transaction (G-37)
-- ---------------------------------------------------------------------------
--
-- The service inserted `orders`, then inserted `order_items`, and on failure
-- issued a compensating DELETE. A crash between the two statements left an
-- order with no items — a paid-looking record with nothing in it, and the
-- compensating delete never ran because the process was gone.
--
-- A function body is a single transaction, so either both inserts land or
-- neither does. The compensating delete is removed from the service.
--
-- Items arrive as a JSON array so the signature does not change every time a
-- column is added. Prices are computed server-side before the call; this
-- function trusts them and is not a pricing authority.

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_order_id         uuid,
    p_parent_id        uuid,
    p_school_id        uuid,
    p_idempotency_key  text,
    p_shipping_address text,
    p_notes            text,
    p_total_cents      integer,
    p_items            jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_order_id uuid;
BEGIN
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'An order must contain at least one item';
    END IF;

    INSERT INTO orders (
        id, parent_id, school_id, idempotency_key,
        status, total_cents, shipping_address, notes
    )
    VALUES (
        p_order_id, p_parent_id, p_school_id, p_idempotency_key,
        'pending', p_total_cents, p_shipping_address, p_notes
    )
    RETURNING id INTO v_order_id;

    -- Item ids are supplied by the caller so the response it returns matches
    -- what was stored, without a follow-up read.
    INSERT INTO order_items (
        id, order_id, photo_id, product_type, quantity, unit_price_cents
    )
    SELECT
        (item ->> 'id')::uuid,
        v_order_id,
        (item ->> 'photo_id')::uuid,
        item ->> 'product_type',
        (item ->> 'quantity')::integer,
        (item ->> 'unit_price_cents')::integer
    FROM jsonb_array_elements(p_items) AS item;

    RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION create_order_with_items IS
    'Creates an order and its line items in a single transaction. Called by '
    'order.service.createOrder. Prices are computed server-side before the '
    'call — this function does not price anything.';
