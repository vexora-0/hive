-- =============================================================================
-- Migration: 00015_storage_photos_bucket
-- Description: Create Supabase Storage bucket for teacher photo uploads.
-- Public read so feed/photo URLs work; authenticated users can upload.
-- If the INSERT fails (e.g. managed Supabase), create bucket "photos" in
-- Dashboard: Storage -> New bucket -> name "photos", Public ON.
-- =============================================================================

-- Create the photos bucket (public so getPublicUrl works for feed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  26214400,  -- 25MB
  ARRAY['image/jpeg', 'image/png', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users (teachers) to upload to photos bucket
CREATE POLICY "photos_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');

-- Allow overwrite for upsert (required for upsert: true in client)
CREATE POLICY "photos_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'photos');

-- Public read is implicit for public buckets; add SELECT so anon can read if needed
CREATE POLICY "photos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');
