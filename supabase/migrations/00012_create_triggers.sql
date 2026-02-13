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
