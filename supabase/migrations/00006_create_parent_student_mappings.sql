-- =============================================================================
-- Migration: 00006_create_parent_student_mappings
-- Description: Many-to-many mapping between parents and students
-- A parent can have multiple children; a child can have multiple parents/guardians.
-- =============================================================================

CREATE TABLE parent_student_mappings (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id      uuid        NOT NULL REFERENCES profiles ON DELETE CASCADE,
    student_id     uuid        NOT NULL REFERENCES students ON DELETE CASCADE,
    relationship   text        NOT NULL DEFAULT 'parent',
    created_at     timestamptz NOT NULL DEFAULT now(),

    -- Each parent-student pair must be unique
    CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
);

-- Lookup children for a given parent (used by RLS helper functions)
CREATE INDEX idx_psm_parent_id ON parent_student_mappings (parent_id);

-- Lookup parents for a given student (used for notifications)
CREATE INDEX idx_psm_student_id ON parent_student_mappings (student_id);

COMMENT ON TABLE parent_student_mappings IS 'Links parent profiles to their children. Core to privacy: parents only see photos of their own children.';
COMMENT ON COLUMN parent_student_mappings.relationship IS 'e.g., parent, guardian, grandparent';
