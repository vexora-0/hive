-- =============================================================================
-- Migration: 00002_create_schools
-- Description: Create schools table - top-level organizational entity
-- =============================================================================

CREATE TABLE schools (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    address     text,
    phone       text,
    logo_url    text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schools IS 'Preschools registered on the Hive platform';
COMMENT ON COLUMN schools.logo_url IS 'URL to the school logo image in storage';
