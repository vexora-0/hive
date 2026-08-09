-- =============================================================================
-- Migration: 00024_notification_feed_fixes
-- Description: Stop the per-photo teacher upload notification, and index the
--              notification feed for its new recency-only ordering.
--
-- Idempotent and additive — safe to re-run against a database that already
-- has it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DROP THE PER-PHOTO TEACHER UPLOAD NOTIFICATION
-- ---------------------------------------------------------------------------
-- `trg_photos_notify_teacher` (00012) is FOR EACH ROW, so confirming a
-- 20-photo batch inserted 20 `upload_complete` rows addressed to the teacher
-- who had just watched all 20 upload. With unread-first ordering and
-- one-at-a-time mark-as-read, clearing them took 20 taps.
--
-- Collapsing per batch was the other option and it is not reachable from here:
-- `photos` carries no batch or upload-session identifier, and adding one means
-- changing the upload path, which belongs to another plan. Suppression is the
-- better answer regardless, because neither branch of the trigger carries
-- information the teacher does not already have:
--
--   * 'ready' duplicates the screen the teacher is looking at. Once the last
--     photo confirms, apps/mobile/src/app/(teacher)/upload.tsx renders
--     "All Photos Uploaded!" with the batch count.
--   * 'failed' is unreachable. Nothing in the backend ever writes
--     `status = 'failed'` — processing is synchronous with sharp, so a failure
--     surfaces immediately on the tile with a retry button and the row stays
--     'processing'. The branch has never fired in production.
--
-- Rows already inserted are left alone. They are the user's data, and
-- PATCH /notifications/read-all now clears the backlog in one tap. The
-- 'upload_complete' value stays in the `notifications.type` CHECK constraint
-- for the same reason — those historical rows still have to validate.

DROP TRIGGER IF EXISTS trg_photos_notify_teacher ON photos;
DROP FUNCTION IF EXISTS notify_teacher_on_upload_complete();

-- ---------------------------------------------------------------------------
-- 2. INDEX THE FEED FOR RECENCY-ONLY ORDERING
-- ---------------------------------------------------------------------------
-- The feed no longer sorts unread-first: marking a row read re-sorted it to
-- the bottom of the list, so the row jumped out from under the finger that had
-- just tapped it. It now sorts by `(created_at DESC, id DESC)` alone, which
-- `idx_notifications_user_feed (user_id, is_read, created_at DESC)` cannot
-- serve — `is_read` sits between the equality column and the sort key, so the
-- planner has to sort.
--
-- The old index stays: `getUnreadCount` filters on `(user_id, is_read)` and is
-- still served by it.

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
    ON notifications (user_id, created_at DESC, id DESC);

COMMENT ON INDEX idx_notifications_user_recent IS
    'Notification feed keyset pagination: newest first, id as tiebreak';
