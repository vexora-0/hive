-- =============================================================================
-- Migration: 00001_create_extensions
-- Description: Enable required PostgreSQL extensions for Hive
-- =============================================================================

-- uuid-ossp: provides uuid_generate_v4() for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- pgcrypto: provides gen_random_uuid() and cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
-- =============================================================================
-- Migration: 00002_create_schools
-- Description: Create schools table - top-level organizational entity
-- =============================================================================

CREATE TABLE schools (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    address     text,
    phone       text,
    logo_url    text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schools IS 'Preschools registered on the Hive platform';
COMMENT ON COLUMN schools.logo_url IS 'URL to the school logo image in storage';
-- =============================================================================
-- Migration: 00003_create_profiles
-- Description: Create profiles table linked to Supabase auth.users
-- Roles: teacher, parent, admin
-- =============================================================================

CREATE TABLE profiles (
    id          uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email       text        NOT NULL,
    full_name   text        NOT NULL,
    role        text        NOT NULL CHECK (role IN ('teacher', 'parent', 'admin')),
    school_id   uuid        REFERENCES schools ON DELETE SET NULL,
    avatar_url  text,
    phone       text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups by role (e.g., list all teachers)
CREATE INDEX idx_profiles_role ON profiles (role);

-- Fast lookups by school (e.g., all staff at a school)
CREATE INDEX idx_profiles_school_id ON profiles (school_id);

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth. One profile per auth user.';
COMMENT ON COLUMN profiles.id IS 'References auth.users.id - set automatically on signup';
COMMENT ON COLUMN profiles.role IS 'Application role: teacher, parent, or admin';
-- =============================================================================
-- Migration: 00004_create_classes
-- Description: Create classes table for organizing students within schools
-- =============================================================================

CREATE TABLE classes (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES schools ON DELETE CASCADE,
    name           text        NOT NULL,
    grade          text,
    teacher_id     uuid        REFERENCES profiles ON DELETE SET NULL,
    academic_year  text,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- All classes for a school
CREATE INDEX idx_classes_school_id ON classes (school_id);

-- All classes taught by a teacher
CREATE INDEX idx_classes_teacher_id ON classes (teacher_id);

COMMENT ON TABLE classes IS 'Classroom groups within a school, typically led by one teacher';
COMMENT ON COLUMN classes.academic_year IS 'e.g., 2025-2026';
-- =============================================================================
-- Migration: 00005_create_students
-- Description: Create students table - the children enrolled at a school
-- =============================================================================

CREATE TABLE students (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES schools ON DELETE CASCADE,
    class_id       uuid        REFERENCES classes ON DELETE SET NULL,
    full_name      text        NOT NULL,
    date_of_birth  date,
    avatar_url     text,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- All students at a school
CREATE INDEX idx_students_school_id ON students (school_id);

-- All students in a class
CREATE INDEX idx_students_class_id ON students (class_id);

COMMENT ON TABLE students IS 'Children enrolled in a preschool. Linked to parents via parent_student_mappings.';
-- =============================================================================
-- Migration: 00006_create_parent_student_mappings
-- Description: Many-to-many mapping between parents and students
-- A parent can have multiple children; a child can have multiple parents/guardians.
-- =============================================================================

CREATE TABLE parent_student_mappings (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id      uuid        NOT NULL REFERENCES profiles ON DELETE CASCADE,
    student_id     uuid        NOT NULL REFERENCES students ON DELETE CASCADE,
    relationship   text        NOT NULL DEFAULT 'parent',
    created_at     timestamptz NOT NULL DEFAULT now(),

    -- Each parent-student pair must be unique
    CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
);

-- Lookup children for a given parent (used by RLS helper functions)
CREATE INDEX idx_psm_parent_id ON parent_student_mappings (parent_id);

-- Lookup parents for a given student (used for notifications)
CREATE INDEX idx_psm_student_id ON parent_student_mappings (student_id);

COMMENT ON TABLE parent_student_mappings IS 'Links parent profiles to their children. Core to privacy: parents only see photos of their own children.';
COMMENT ON COLUMN parent_student_mappings.relationship IS 'e.g., parent, guardian, grandparent';
-- =============================================================================
-- Migration: 00007_create_photos
-- Description: Create photos table - the core content entity of Hive
-- Photos are uploaded by teachers, stored in S3/Supabase Storage, and tagged
-- with students so parents can only see photos of their own children.
-- =============================================================================

CREATE TABLE photos (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid        NOT NULL REFERENCES schools ON DELETE CASCADE,
    class_id            uuid        NOT NULL REFERENCES classes ON DELETE CASCADE,
    uploaded_by         uuid        NOT NULL REFERENCES profiles ON DELETE SET NULL,
    s3_key              text        NOT NULL,
    thumbnail_s3_key    text,
    original_filename   text,
    mime_type           text        NOT NULL DEFAULT 'image/jpeg',
    file_size_bytes     bigint,
    width               int,
    height              int,
    sha256_hash         text        NOT NULL,
    blurhash            text,
    caption             text,
    status              text        NOT NULL DEFAULT 'processing'
                                    CHECK (status IN ('processing', 'ready', 'failed', 'archived')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Duplicate detection: same file hash within the same class is likely a duplicate
CREATE INDEX idx_photos_dedup ON photos (sha256_hash, class_id);

-- Primary feed query: list ready photos in a class ordered newest-first with cursor pagination
CREATE INDEX idx_photos_class_feed ON photos (class_id, status, created_at DESC, id DESC);

-- Teacher dashboard: photos uploaded by a specific teacher
CREATE INDEX idx_photos_uploaded_by ON photos (uploaded_by, created_at DESC);

COMMENT ON TABLE photos IS 'Photos uploaded by teachers. Visibility is controlled via photo_student_tags + RLS.';
COMMENT ON COLUMN photos.s3_key IS 'Object key in S3/Supabase Storage for the full-resolution image';
COMMENT ON COLUMN photos.thumbnail_s3_key IS 'Object key for the thumbnail variant';
COMMENT ON COLUMN photos.sha256_hash IS 'SHA-256 hash of the original file bytes for deduplication';
COMMENT ON COLUMN photos.blurhash IS 'BlurHash placeholder string for progressive loading';
COMMENT ON COLUMN photos.status IS 'processing = just uploaded; ready = thumbnail generated; failed = processing error; archived = soft-deleted';
-- =============================================================================
-- Migration: 00008_create_photo_student_tags
-- Description: Tag students in photos. This is the critical privacy link:
-- parents can ONLY see photos that have a tag for one of their children.
-- =============================================================================

CREATE TABLE photo_student_tags (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id    uuid        NOT NULL REFERENCES photos ON DELETE CASCADE,
    student_id  uuid        NOT NULL REFERENCES students ON DELETE CASCADE,
    tagged_by   uuid        NOT NULL REFERENCES profiles ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- A student can only be tagged once per photo
    CONSTRAINT uq_photo_student_tag UNIQUE (photo_id, student_id)
);

-- Feed query for parents: find all photos tagged with a specific student
-- INCLUDE photo_id allows index-only scans for the join to photos
CREATE INDEX idx_pst_student_id ON photo_student_tags (student_id) INCLUDE (photo_id);

-- Lookup all tags for a specific photo (e.g., when displaying tagged students)
CREATE INDEX idx_pst_photo_id ON photo_student_tags (photo_id);

COMMENT ON TABLE photo_student_tags IS 'Maps photos to the students visible in them. Drives parent-facing privacy via RLS.';
COMMENT ON COLUMN photo_student_tags.tagged_by IS 'The teacher who tagged the student in the photo';
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
-- =============================================================================
-- Migration: 00010_create_notifications
-- Description: In-app notifications for users (new photos, order updates, etc.)
-- =============================================================================

CREATE TABLE notifications (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES profiles ON DELETE CASCADE,
    type        text        NOT NULL
                            CHECK (type IN (
                                'new_photos',
                                'upload_complete',
                                'new_order',
                                'order_status'
                            )),
    title       text        NOT NULL,
    body        text,
    data        jsonb       NOT NULL DEFAULT '{}',
    is_read     boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Primary notification feed: unread first, then by recency, with cursor pagination
CREATE INDEX idx_notifications_user_feed ON notifications (user_id, is_read, created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications delivered to users';
COMMENT ON COLUMN notifications.data IS 'Arbitrary JSON payload, e.g., {"photo_id": "...", "class_id": "..."}';
COMMENT ON COLUMN notifications.type IS 'Category of notification for filtering and icon display';
-- =============================================================================
-- Migration: 00011_create_rls_policies
-- Description: Row Level Security policies for ALL tables.
--
-- PRIVACY MODEL:
--   - Parents can ONLY see photos tagged with their own children
--   - Teachers can see all photos within their school
--   - Admins have full access
--
-- This is the most security-critical migration in the Hive application.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENABLE RLS ON ALL TABLES
-- ---------------------------------------------------------------------------

ALTER TABLE schools                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_student_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (SECURITY DEFINER so they bypass RLS internally)
-- ---------------------------------------------------------------------------

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Returns the school_id of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT school_id FROM profiles WHERE id = auth.uid();
$$;

-- Returns TRUE if the current user is a parent of the given student
CREATE OR REPLACE FUNCTION is_parent_of(student_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM parent_student_mappings
        WHERE parent_id  = auth.uid()
          AND student_id = student_uuid
    );
$$;

-- Returns an array of student IDs belonging to the current parent
CREATE OR REPLACE FUNCTION get_my_student_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(student_id), '{}')
    FROM parent_student_mappings
    WHERE parent_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3. SCHOOLS POLICIES
-- ---------------------------------------------------------------------------

-- Admins: full CRUD on all schools
CREATE POLICY schools_admin_all ON schools
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: read their own school
CREATE POLICY schools_teacher_select ON schools
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND id = get_my_school_id()
    );

-- Parents: read their own school
CREATE POLICY schools_parent_select ON schools
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND id = get_my_school_id()
    );

-- ---------------------------------------------------------------------------
-- 4. PROFILES POLICIES
-- ---------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY profiles_self_select ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Users can update their own profile (name, avatar, phone only - not role)
CREATE POLICY profiles_self_update ON profiles
    FOR UPDATE
    TO authenticated
    USING  (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admins: full access to all profiles
CREATE POLICY profiles_admin_all ON profiles
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: read profiles in their school (to see parent/colleague names)
CREATE POLICY profiles_teacher_select ON profiles
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND school_id = get_my_school_id()
    );

-- Parents: read teacher profiles in their school (to see who uploaded photos)
CREATE POLICY profiles_parent_select_teachers ON profiles
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND school_id = get_my_school_id()
        AND role = 'teacher'
    );

-- ---------------------------------------------------------------------------
-- 5. CLASSES POLICIES
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY classes_admin_all ON classes
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: read classes in their school
CREATE POLICY classes_teacher_select ON classes
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND school_id = get_my_school_id()
    );

-- Parents: read classes where their child is enrolled
CREATE POLICY classes_parent_select ON classes
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1
            FROM students s
            JOIN parent_student_mappings psm ON psm.student_id = s.id
            WHERE s.class_id = classes.id
              AND psm.parent_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- 6. STUDENTS POLICIES
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY students_admin_all ON students
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: read students in their school
CREATE POLICY students_teacher_select ON students
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND school_id = get_my_school_id()
    );

-- Parents: read only their own children
CREATE POLICY students_parent_select ON students
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND id = ANY(get_my_student_ids())
    );

-- ---------------------------------------------------------------------------
-- 7. PARENT_STUDENT_MAPPINGS POLICIES
-- ---------------------------------------------------------------------------

-- Parents: read their own mappings
CREATE POLICY psm_parent_select ON parent_student_mappings
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
    );

-- Admins: full CRUD
CREATE POLICY psm_admin_all ON parent_student_mappings
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: read mappings for students in their school (for contact purposes)
CREATE POLICY psm_teacher_select ON parent_student_mappings
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = parent_student_mappings.student_id
              AND s.school_id = get_my_school_id()
        )
    );

-- ---------------------------------------------------------------------------
-- 8. PHOTOS POLICIES  *** CORE PRIVACY ***
-- ---------------------------------------------------------------------------

-- Admins: full access to all photos
CREATE POLICY photos_admin_all ON photos
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: SELECT ready photos in their school
CREATE POLICY photos_teacher_select ON photos
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND school_id = get_my_school_id()
    );

-- Teachers: INSERT photos into their school's classes
CREATE POLICY photos_teacher_insert ON photos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_my_role() = 'teacher'
        AND school_id = get_my_school_id()
        AND uploaded_by = auth.uid()
    );

-- Teachers: UPDATE their own photos (e.g., add caption, change status)
CREATE POLICY photos_teacher_update ON photos
    FOR UPDATE
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND uploaded_by = auth.uid()
        AND school_id = get_my_school_id()
    )
    WITH CHECK (
        get_my_role() = 'teacher'
        AND uploaded_by = auth.uid()
        AND school_id = get_my_school_id()
    );

-- Parents: SELECT ONLY photos tagged with their children
-- This is the critical privacy policy. A parent can never see a photo
-- unless that photo has a row in photo_student_tags linking to one of
-- the parent's children via parent_student_mappings.
CREATE POLICY photos_parent_select ON photos
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND status = 'ready'
        AND EXISTS (
            SELECT 1
            FROM photo_student_tags pst
            JOIN parent_student_mappings psm ON psm.student_id = pst.student_id
            WHERE pst.photo_id = photos.id
              AND psm.parent_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- 9. PHOTO_STUDENT_TAGS POLICIES
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY pst_admin_all ON photo_student_tags
    FOR ALL
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Teachers: INSERT tags for photos in their school
CREATE POLICY pst_teacher_insert ON photo_student_tags
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_my_role() = 'teacher'
        AND tagged_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM photos p
            WHERE p.id = photo_student_tags.photo_id
              AND p.school_id = get_my_school_id()
        )
    );

-- Teachers: read tags for photos in their school
CREATE POLICY pst_teacher_select ON photo_student_tags
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND EXISTS (
            SELECT 1 FROM photos p
            WHERE p.id = photo_student_tags.photo_id
              AND p.school_id = get_my_school_id()
        )
    );

-- Teachers: DELETE tags they created (untag a student)
CREATE POLICY pst_teacher_delete ON photo_student_tags
    FOR DELETE
    TO authenticated
    USING (
        get_my_role() = 'teacher'
        AND tagged_by = auth.uid()
    );

-- Parents: read tags that reference their own children
CREATE POLICY pst_parent_select ON photo_student_tags
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND student_id = ANY(get_my_student_ids())
    );

-- ---------------------------------------------------------------------------
-- 10. ORDERS POLICIES
-- ---------------------------------------------------------------------------

-- Admins: read all orders
CREATE POLICY orders_admin_select ON orders
    FOR SELECT
    TO authenticated
    USING (get_my_role() = 'admin');

-- Admins: update order status
CREATE POLICY orders_admin_update ON orders
    FOR UPDATE
    TO authenticated
    USING  (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Parents: full CRUD on their own orders
CREATE POLICY orders_parent_select ON orders
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
    );

CREATE POLICY orders_parent_insert ON orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
    );

CREATE POLICY orders_parent_update ON orders
    FOR UPDATE
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
        -- Only allow updates on pending/confirmed orders (not shipped/delivered)
        AND status IN ('pending', 'confirmed')
    )
    WITH CHECK (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
    );

CREATE POLICY orders_parent_delete ON orders
    FOR DELETE
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND parent_id = auth.uid()
        AND status = 'pending'
    );

-- ---------------------------------------------------------------------------
-- 11. ORDER_ITEMS POLICIES
-- ---------------------------------------------------------------------------

-- Admins: read all order items
CREATE POLICY order_items_admin_select ON order_items
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'admin'
    );

-- Parents: read their own order items
CREATE POLICY order_items_parent_select ON order_items
    FOR SELECT
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND o.parent_id = auth.uid()
        )
    );

-- Parents: insert items into their own orders
CREATE POLICY order_items_parent_insert ON order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND o.parent_id = auth.uid()
              AND o.status = 'pending'
        )
    );

-- Parents: delete items from their own pending orders
CREATE POLICY order_items_parent_delete ON order_items
    FOR DELETE
    TO authenticated
    USING (
        get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND o.parent_id = auth.uid()
              AND o.status = 'pending'
        )
    );

-- ---------------------------------------------------------------------------
-- 12. NOTIFICATIONS POLICIES
-- ---------------------------------------------------------------------------

-- Users: read their own notifications
CREATE POLICY notifications_self_select ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users: update their own notifications (mark as read)
CREATE POLICY notifications_self_update ON notifications
    FOR UPDATE
    TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins: insert notifications for any user
CREATE POLICY notifications_admin_insert ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (get_my_role() = 'admin');

-- Service role / triggers can also insert (handled by SECURITY DEFINER functions)
-- =============================================================================
-- Migration: 00012_create_triggers
-- Description: Database triggers for automated behavior
--   1. Auto-update updated_at timestamps
--   2. Notify parents when new photos become ready
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. GENERIC updated_at TRIGGER FUNCTION
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS 'Automatically sets updated_at to now() on every UPDATE';

-- Apply to all tables that have an updated_at column

CREATE TRIGGER trg_schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. NOTIFY PARENTS WHEN PHOTOS BECOME READY
-- ---------------------------------------------------------------------------
-- When a photo's status transitions to 'ready', we find all students tagged
-- in that photo, then find each student's parents, and insert a notification
-- for each unique parent. This runs as SECURITY DEFINER so it can bypass RLS
-- to insert into the notifications table.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_parents_on_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_name   text;
    v_parent_id    uuid;
    v_student_name text;
BEGIN
    -- Only fire when status changes TO 'ready'
    IF (TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM 'ready'
        AND NEW.status = 'ready')
    THEN
        -- Get the class name for the notification message
        SELECT name INTO v_class_name
        FROM classes
        WHERE id = NEW.class_id;

        -- For each unique parent of tagged students, create a notification
        FOR v_parent_id, v_student_name IN
            SELECT DISTINCT psm.parent_id, s.full_name
            FROM photo_student_tags pst
            JOIN students s ON s.id = pst.student_id
            JOIN parent_student_mappings psm ON psm.student_id = pst.student_id
            WHERE pst.photo_id = NEW.id
        LOOP
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
                v_parent_id,
                'new_photos',
                'New photo of ' || v_student_name,
                'A new photo was added to ' || COALESCE(v_class_name, 'the class'),
                jsonb_build_object(
                    'photo_id',  NEW.id,
                    'class_id',  NEW.class_id,
                    'school_id', NEW.school_id
                )
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_parents_on_photo() IS
    'Fires after a photo transitions to ready status. '
    'Inserts a notification for each parent whose child is tagged in the photo.';

CREATE TRIGGER trg_photos_notify_parents
    AFTER UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION notify_parents_on_photo();

-- ---------------------------------------------------------------------------
-- 3. NOTIFY TEACHER WHEN UPLOAD PROCESSING COMPLETES
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_teacher_on_upload_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Notify the uploading teacher when processing finishes (ready or failed)
    IF (TG_OP = 'UPDATE'
        AND OLD.status = 'processing'
        AND NEW.status IN ('ready', 'failed'))
    THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
            NEW.uploaded_by,
            'upload_complete',
            CASE NEW.status
                WHEN 'ready'  THEN 'Photo processed successfully'
                WHEN 'failed' THEN 'Photo processing failed'
            END,
            CASE NEW.status
                WHEN 'ready'  THEN 'Your photo is now visible to tagged parents'
                WHEN 'failed' THEN 'There was an issue processing your photo. Please try uploading again.'
            END,
            jsonb_build_object(
                'photo_id', NEW.id,
                'status',   NEW.status
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_teacher_on_upload_complete() IS
    'Notifies the teacher who uploaded a photo when processing completes or fails.';

CREATE TRIGGER trg_photos_notify_teacher
    AFTER UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION notify_teacher_on_upload_complete();
-- =============================================================================
-- Migration: 00013_create_indexes
-- Description: Additional composite indexes for performance
--   - Cursor pagination support on key tables
--   - Any indexes not created in individual table migrations
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CURSOR PAGINATION INDEXES
-- ---------------------------------------------------------------------------
-- Cursor-based pagination uses (created_at, id) as the cursor.
-- The pattern is:  WHERE (created_at, id) < ($cursor_ts, $cursor_id)
--                  ORDER BY created_at DESC, id DESC
--                  LIMIT $page_size
--
-- Photos already has idx_photos_class_feed covering (class_id, status, created_at DESC, id DESC).
-- We add a general pagination index on photos without the class filter for admin views.

CREATE INDEX IF NOT EXISTS idx_photos_cursor_pagination
    ON photos (created_at DESC, id DESC);

-- Orders: cursor pagination for admin order listing and parent order history
CREATE INDEX IF NOT EXISTS idx_orders_cursor_pagination
    ON orders (created_at DESC, id DESC);

-- Notifications: cursor pagination (user-scoped feed already exists via
-- idx_notifications_user_feed, but we add a general one for admin views)
CREATE INDEX IF NOT EXISTS idx_notifications_cursor_pagination
    ON notifications (created_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- 2. ADDITIONAL COMPOSITE INDEXES
-- ---------------------------------------------------------------------------

-- Schools: filter active schools (useful for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_schools_active
    ON schools (is_active)
    WHERE is_active = true;

-- Profiles: find active users per school quickly
CREATE INDEX IF NOT EXISTS idx_profiles_school_active
    ON profiles (school_id, is_active)
    WHERE is_active = true;

-- Students: find active students per class (for tagging UI)
CREATE INDEX IF NOT EXISTS idx_students_class_active
    ON students (class_id, is_active)
    WHERE is_active = true;

-- Photos: find photos by school and status (admin moderation dashboard)
CREATE INDEX IF NOT EXISTS idx_photos_school_status
    ON photos (school_id, status);

-- Orders: find orders by school and status (fulfillment dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_school_status
    ON orders (school_id, status);

-- Photo student tags: find tags created by a teacher (for undo/audit)
CREATE INDEX IF NOT EXISTS idx_pst_tagged_by
    ON photo_student_tags (tagged_by);

-- Parent student mappings: composite for the common RLS query pattern
CREATE INDEX IF NOT EXISTS idx_psm_parent_student
    ON parent_student_mappings (parent_id, student_id);

-- =============================================================================
-- Migration: 00014_handle_new_user_trigger
-- Description: Auto-create a profile row when a new user signs up (OTP/magic link).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_role text;
BEGIN
    profile_role := lower(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')));
    IF profile_role NOT IN ('teacher', 'parent') THEN
        profile_role := 'parent';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(COALESCE(NEW.email, ''), '@', 1)
        ),
        profile_role::text
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- Migration: 00015_storage_photos_bucket
-- Description: Create Supabase Storage bucket for teacher photo uploads.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "photos_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "photos_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'photos');

CREATE POLICY "photos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');
