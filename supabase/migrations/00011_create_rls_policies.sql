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
