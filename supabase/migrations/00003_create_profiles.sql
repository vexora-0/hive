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
