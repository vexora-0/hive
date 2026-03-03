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
