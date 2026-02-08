-- =============================================================================
-- Migration: 00005_create_students
-- Description: Create students table - the children enrolled at a school
-- =============================================================================

CREATE TABLE students (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id      uuid        NOT NULL REFERENCES schools ON DELETE CASCADE,
    class_id       uuid        REFERENCES classes ON DELETE SET NULL,
    full_name      text        NOT NULL,
    date_of_birth  date,
    avatar_url     text,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- All students at a school
CREATE INDEX idx_students_school_id ON students (school_id);

-- All students in a class
CREATE INDEX idx_students_class_id ON students (class_id);

COMMENT ON TABLE students IS 'Children enrolled in a preschool. Linked to parents via parent_student_mappings.';
