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
