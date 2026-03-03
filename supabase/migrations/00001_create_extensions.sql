-- =============================================================================
-- Migration: 00001_create_extensions
-- Description: Enable required PostgreSQL extensions for Hive
-- =============================================================================

-- uuid-ossp: provides uuid_generate_v4() for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- pgcrypto: provides gen_random_uuid() and cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
