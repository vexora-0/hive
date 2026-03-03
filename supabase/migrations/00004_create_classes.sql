-- =============================================================================
-- Migration: 00004_create_classes
-- Description: Create classes table for organizing students within schools
-- =============================================================================

CREATE TABLE classes (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES schools ON DELETE CASCADE,
    name           text        NOT NULL,
    grade          text,
    teacher_id     uuid        REFERENCES profiles ON DELETE SET NULL,
    academic_year  text,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- All classes for a school
CREATE INDEX idx_classes_school_id ON classes (school_id);

-- All classes taught by a teacher
CREATE INDEX idx_classes_teacher_id ON classes (teacher_id);

COMMENT ON TABLE classes IS 'Classroom groups within a school, typically led by one teacher';
COMMENT ON COLUMN classes.academic_year IS 'e.g., 2025-2026';
