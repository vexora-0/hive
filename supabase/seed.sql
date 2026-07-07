-- =============================================================================
-- Seed Data for Hive (Development / Demo)
-- =============================================================================
-- NOTE: In production, profiles are created via the auth signup flow and a
-- database trigger or Edge Function. This seed data simulates that flow
-- by inserting directly. The auth.users entries would need to exist first
-- in a real Supabase instance.
--
-- For the ADMIN user, run the backend script:
--   ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm seed:admin   (in packages/backend)
-- That creates the auth.users entry via the Supabase Admin API. Both variables
-- are required and have no default, so no credential is written down here.
--
-- These UUIDs are deterministic so they can be referenced in tests.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SCHOOLS
-- ---------------------------------------------------------------------------

INSERT INTO schools (id, name, address, phone) VALUES
    ('a0000000-0000-4000-8000-000000000001',
     'Bloom Preschool',
     '123 MG Road, Koramangala, Bangalore 560034',
     '+91 98765 43210'),
    ('a0000000-0000-4000-8000-000000000002',
     'Little Stars Academy',
     '456 Linking Road, Bandra West, Mumbai 400050',
     '+91 98765 43211');

-- ---------------------------------------------------------------------------
-- 2. PROFILES
-- ---------------------------------------------------------------------------
-- NOTE: In a real environment these IDs must match auth.users entries.
-- For seeding purposes we insert directly. If running against a live
-- Supabase instance, create the auth users first, then update these IDs.
-- ---------------------------------------------------------------------------

-- Admin (auth user created via seed:admin script)
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('aa000000-0000-4000-8000-000000000001',
     'admin@hive.app',
     'Hive Admin',
     'admin',
     NULL);

-- Teacher 1 - Sarita Devi (Bloom Preschool)
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('b0000000-0000-4000-8000-000000000001',
     'teacher.sarita@bloom.edu',
     'Sarita Devi',
     'teacher',
     'a0000000-0000-4000-8000-000000000001');

-- Teacher 2 - Dinesh Kumar (Bloom Preschool)
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('b0000000-0000-4000-8000-000000000002',
     'teacher.dinesh@bloom.edu',
     'Dinesh Kumar',
     'teacher',
     'a0000000-0000-4000-8000-000000000001');

-- Teacher 3 - Kavitha Reddy (Little Stars Academy)
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('b0000000-0000-4000-8000-000000000003',
     'teacher.kavitha@littlestars.edu',
     'Kavitha Reddy',
     'teacher',
     'a0000000-0000-4000-8000-000000000002');

-- Parent 1 - Rajesh Kumar
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('c0000000-0000-4000-8000-000000000001',
     'parent.rajesh@example.com',
     'Rajesh Kumar',
     'parent',
     'a0000000-0000-4000-8000-000000000001');

-- Parent 2 - Lakshmi Menon
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('c0000000-0000-4000-8000-000000000002',
     'parent.lakshmi@example.com',
     'Lakshmi Menon',
     'parent',
     'a0000000-0000-4000-8000-000000000001');

-- Parent 3 - Jagdish Sharma
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('c0000000-0000-4000-8000-000000000003',
     'parent.jagdish@example.com',
     'Jagdish Sharma',
     'parent',
     'a0000000-0000-4000-8000-000000000001');

-- Parent 4 - Priya Patel
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('c0000000-0000-4000-8000-000000000004',
     'parent.priya@example.com',
     'Priya Patel',
     'parent',
     'a0000000-0000-4000-8000-000000000002');

-- Parent 5 - Sunita Nair
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('c0000000-0000-4000-8000-000000000005',
     'parent.sunita@example.com',
     'Sunita Nair',
     'parent',
     'a0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- 3. CLASSES
-- ---------------------------------------------------------------------------

-- Bloom Preschool classes
INSERT INTO classes (id, school_id, name, grade, teacher_id, academic_year) VALUES
    ('d0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'Lotus Room',
     'Pre-K',
     'b0000000-0000-4000-8000-000000000001',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001',
     'Rainbow Room',
     'Toddlers',
     'b0000000-0000-4000-8000-000000000001',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001',
     'Little Explorers',
     'Pre-K',
     'b0000000-0000-4000-8000-000000000002',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000004',
     'a0000000-0000-4000-8000-000000000001',
     'Busy Bees',
     'Nursery',
     'b0000000-0000-4000-8000-000000000002',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000005',
     'a0000000-0000-4000-8000-000000000001',
     'Starfish',
     'Infants',
     NULL,
     '2025-2026');

-- Little Stars Academy classes
INSERT INTO classes (id, school_id, name, grade, teacher_id, academic_year) VALUES
    ('d0000000-0000-4000-8000-000000000006',
     'a0000000-0000-4000-8000-000000000002',
     'Moonbeams',
     'Pre-K',
     'b0000000-0000-4000-8000-000000000003',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000007',
     'a0000000-0000-4000-8000-000000000002',
     'Comets',
     'Toddlers',
     'b0000000-0000-4000-8000-000000000003',
     '2025-2026'),
    ('d0000000-0000-4000-8000-000000000008',
     'a0000000-0000-4000-8000-000000000002',
     'Twinkle Stars',
     'Nursery',
     NULL,
     '2025-2026');

-- ---------------------------------------------------------------------------
-- 4. STUDENTS
-- ---------------------------------------------------------------------------

-- Bloom Preschool students
INSERT INTO students (id, school_id, class_id, full_name, date_of_birth) VALUES
    ('e0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000001',
     'Ananya Kumar',
     '2021-03-15'),
    ('e0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000002',
     'Aarav Kumar',
     '2022-07-22'),
    ('e0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000001',
     'Diya Menon',
     '2021-09-10'),
    ('e0000000-0000-4000-8000-000000000004',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000003',
     'Arjun Sharma',
     '2021-05-20'),
    ('e0000000-0000-4000-8000-000000000005',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000004',
     'Ishita Sharma',
     '2023-01-08'),
    ('e0000000-0000-4000-8000-000000000006',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000003',
     'Aditya Patel',
     '2021-11-30');

-- Little Stars Academy students
INSERT INTO students (id, school_id, class_id, full_name, date_of_birth) VALUES
    ('e0000000-0000-4000-8000-000000000007',
     'a0000000-0000-4000-8000-000000000002',
     'd0000000-0000-4000-8000-000000000006',
     'Saanvi Reddy',
     '2021-08-14'),
    ('e0000000-0000-4000-8000-000000000008',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000002',
     'Lakshya Kumar',
     '2022-04-03'),
    ('e0000000-0000-4000-8000-000000000009',
     'a0000000-0000-4000-8000-000000000002',
     'd0000000-0000-4000-8000-000000000006',
     'Anika Patel',
     '2021-06-25'),
    ('e0000000-0000-4000-8000-00000000000a',
     'a0000000-0000-4000-8000-000000000002',
     'd0000000-0000-4000-8000-000000000007',
     'Advik Singh',
     '2022-12-01');

-- ---------------------------------------------------------------------------
-- 5. PARENT-STUDENT MAPPINGS
-- ---------------------------------------------------------------------------

-- Rajesh Kumar is parent of Ananya and Aarav
INSERT INTO parent_student_mappings (parent_id, student_id, relationship) VALUES
    ('c0000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000001',
     'parent'),
    ('c0000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000002',
     'parent');

-- Lakshmi Menon is parent of Diya
INSERT INTO parent_student_mappings (parent_id, student_id, relationship) VALUES
    ('c0000000-0000-4000-8000-000000000002',
     'e0000000-0000-4000-8000-000000000003',
     'parent');

-- Jagdish Sharma is parent of Arjun and Ishita
INSERT INTO parent_student_mappings (parent_id, student_id, relationship) VALUES
    ('c0000000-0000-4000-8000-000000000003',
     'e0000000-0000-4000-8000-000000000004',
     'parent'),
    ('c0000000-0000-4000-8000-000000000003',
     'e0000000-0000-4000-8000-000000000005',
     'parent');

-- Priya Patel is parent of Aditya and Anika
INSERT INTO parent_student_mappings (parent_id, student_id, relationship) VALUES
    ('c0000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000006',
     'parent'),
    ('c0000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000009',
     'parent');

-- Sunita Nair is parent of Saanvi
INSERT INTO parent_student_mappings (parent_id, student_id, relationship) VALUES
    ('c0000000-0000-4000-8000-000000000005',
     'e0000000-0000-4000-8000-000000000007',
     'parent');

-- ---------------------------------------------------------------------------
-- 6. DEMO PHOTOS
-- ---------------------------------------------------------------------------

-- Photo 1: Lotus Room - art time (Ananya and Diya visible)
INSERT INTO photos (id, school_id, class_id, uploaded_by, s3_key, thumbnail_s3_key,
                    original_filename, mime_type, file_size_bytes, width, height,
                    sha256_hash, caption, status) VALUES
    ('f0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000001',
     'b0000000-0000-4000-8000-000000000001',
     'schools/a0000000/photos/f0000001-art-time.jpg',
     'schools/a0000000/thumbs/f0000001-art-time.jpg',
     'IMG_2025_art_time.jpg',
     'image/jpeg',
     2457600,
     4032,
     3024,
     'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd',
     'Art time in Lotus Room! The kids loved finger painting today.',
     'ready');

-- Photo 2: Lotus Room - story time (only Ananya visible)
INSERT INTO photos (id, school_id, class_id, uploaded_by, s3_key, thumbnail_s3_key,
                    original_filename, mime_type, file_size_bytes, width, height,
                    sha256_hash, caption, status) VALUES
    ('f0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000001',
     'b0000000-0000-4000-8000-000000000001',
     'schools/a0000000/photos/f0000002-story-time.jpg',
     'schools/a0000000/thumbs/f0000002-story-time.jpg',
     'IMG_2025_story_time.jpg',
     'image/jpeg',
     1843200,
     3024,
     4032,
     'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd',
     'Story time with Ananya - she was so engaged!',
     'ready');

-- Photo 3: Rainbow Room - playground (Aarav visible)
INSERT INTO photos (id, school_id, class_id, uploaded_by, s3_key, thumbnail_s3_key,
                    original_filename, mime_type, file_size_bytes, width, height,
                    sha256_hash, caption, status) VALUES
    ('f0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000002',
     'b0000000-0000-4000-8000-000000000001',
     'schools/a0000000/photos/f0000003-playground.jpg',
     'schools/a0000000/thumbs/f0000003-playground.jpg',
     'IMG_2025_playground.jpg',
     'image/jpeg',
     3072000,
     4032,
     3024,
     'e3f4a5b6c7d8e3f4a5b6c7d8e3f4a5b6c7d8e3f4a5b6c7d8e3f4a5b6c7d8abcd',
     'Playground fun in the Rainbow Room!',
     'ready');

-- Photo 4: Lotus Room - snack time (only Diya visible)
INSERT INTO photos (id, school_id, class_id, uploaded_by, s3_key, thumbnail_s3_key,
                    original_filename, mime_type, file_size_bytes, width, height,
                    sha256_hash, caption, status) VALUES
    ('f0000000-0000-4000-8000-000000000004',
     'a0000000-0000-4000-8000-000000000001',
     'd0000000-0000-4000-8000-000000000001',
     'b0000000-0000-4000-8000-000000000001',
     'schools/a0000000/photos/f0000004-snack-time.jpg',
     'schools/a0000000/thumbs/f0000004-snack-time.jpg',
     'IMG_2025_snack_time.jpg',
     'image/jpeg',
     1536000,
     3024,
     3024,
     'c4d5e6f7a8b9c4d5e6f7a8b9c4d5e6f7a8b9c4d5e6f7a8b9c4d5e6f7a8b9abcd',
     'Snack time - Diya loves her apple slices!',
     'ready');

-- ---------------------------------------------------------------------------
-- 7. PHOTO-STUDENT TAGS
-- ---------------------------------------------------------------------------

-- Photo 1 (art time): tagged with Ananya AND Diya
INSERT INTO photo_student_tags (photo_id, student_id, tagged_by) VALUES
    ('f0000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000001',
     'b0000000-0000-4000-8000-000000000001'),
    ('f0000000-0000-4000-8000-000000000001',
     'e0000000-0000-4000-8000-000000000003',
     'b0000000-0000-4000-8000-000000000001');

-- Photo 2 (story time): tagged with Ananya only
INSERT INTO photo_student_tags (photo_id, student_id, tagged_by) VALUES
    ('f0000000-0000-4000-8000-000000000002',
     'e0000000-0000-4000-8000-000000000001',
     'b0000000-0000-4000-8000-000000000001');

-- Photo 3 (playground): tagged with Aarav only
INSERT INTO photo_student_tags (photo_id, student_id, tagged_by) VALUES
    ('f0000000-0000-4000-8000-000000000003',
     'e0000000-0000-4000-8000-000000000002',
     'b0000000-0000-4000-8000-000000000001');

-- Photo 4 (snack time): tagged with Diya only
INSERT INTO photo_student_tags (photo_id, student_id, tagged_by) VALUES
    ('f0000000-0000-4000-8000-000000000004',
     'e0000000-0000-4000-8000-000000000003',
     'b0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- EXPECTED PRIVACY BEHAVIOR WITH THIS SEED DATA:
-- ---------------------------------------------------------------------------
-- Rajesh (parent 1) should see:
--   - Photo 1 (art time)       -> Ananya is tagged
--   - Photo 2 (story time)     -> Ananya is tagged
--   - Photo 3 (playground)     -> Aarav is tagged
--   Rajesh should NOT see Photo 4 (snack time) - only Diya is tagged
--
-- Lakshmi (parent 2) should see:
--   - Photo 1 (art time)       -> Diya is tagged
--   - Photo 4 (snack time)     -> Diya is tagged
--   Lakshmi should NOT see Photo 2 (story time) or Photo 3 (playground)
--
-- Jagdish (parent 3) should see: no photos yet (no tags for Arjun/Ishita)
-- Priya (parent 4) should see: no photos yet (no tags for Aditya/Anika)
-- Sunita (parent 5) should see: no photos yet (no tags for Saanvi)
--
-- Teacher Sarita should see all 4 photos (in her school)
-- Teacher Dinesh should see all 4 photos (in same school)
-- Teacher Kavitha should see no photos (different school, no photos uploaded)
-- ---------------------------------------------------------------------------
