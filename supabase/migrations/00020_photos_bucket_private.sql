-- =============================================================================
-- Migration: 00020_photos_bucket_private
-- Description: Close the most severe finding in the audit (G-02).
--
-- The photos bucket was created public (00015) with an explicit SELECT policy
-- granted TO public. Combined with the unauthenticated /uploads static route in
-- the API, every child's photograph was reachable by anyone holding or guessing
-- a URL — no credential required.
--
-- After this migration the bucket is private. Photos are reachable only through
-- short-lived signed URLs, which the API issues after verifying the caller is a
-- parent of a tagged child or a teacher at the photo's school.
-- =============================================================================

-- 1. Flip the bucket to private. getPublicUrl() no longer resolves; every read
--    must go through createSignedUrl().
UPDATE storage.buckets
SET public = false
WHERE id = 'photos';

-- 2. Remove the blanket public read grant.
DROP POLICY IF EXISTS "photos_public_read" ON storage.objects;

-- 3. Remove the authenticated write grants.
--
--    These allowed ANY authenticated user — including any parent — to write
--    anywhere in the bucket, because the check was only `bucket_id = 'photos'`
--    with no path or ownership constraint.
--
--    All uploads now go through the backend, which holds the service-role key
--    and bypasses storage RLS. No replacement policy is required for it to work.
DROP POLICY IF EXISTS "photos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "photos_authenticated_update" ON storage.objects;

-- 4. Keep the size and MIME constraints — defence in depth alongside the
--    application-level checks in middleware/upload.ts.
UPDATE storage.buckets
SET file_size_limit    = 26214400,  -- 25 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic']
WHERE id = 'photos';

COMMENT ON COLUMN photos.s3_key IS
    'Object path in the private Supabase Storage "photos" bucket. The column '
    'name is historical — an S3 backend was considered and abandoned. Read '
    'access is via createSignedUrl() only.';

COMMENT ON COLUMN photos.thumbnail_s3_key IS
    'Object path of the 400px thumbnail variant, generated synchronously during '
    'upload. Null only for photos uploaded before 00020.';
