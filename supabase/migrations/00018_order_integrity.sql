-- 00018 — Replace contradictory foreign key actions
--
-- Plan 02, Step 7. Closes G-19.
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
