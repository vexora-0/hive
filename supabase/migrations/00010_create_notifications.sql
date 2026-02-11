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
