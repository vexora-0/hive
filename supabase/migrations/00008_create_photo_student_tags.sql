-- =============================================================================
-- Migration: 00008_create_photo_student_tags
-- Description: Tag students in photos. This is the critical privacy link:
-- parents can ONLY see photos that have a tag for one of their children.
-- =============================================================================

CREATE TABLE photo_student_tags (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id    uuid        NOT NULL REFERENCES photos ON DELETE CASCADE,
    student_id  uuid        NOT NULL REFERENCES students ON DELETE CASCADE,
    tagged_by   uuid        NOT NULL REFERENCES profiles ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- A student can only be tagged once per photo
    CONSTRAINT uq_photo_student_tag UNIQUE (photo_id, student_id)
);

-- Feed query for parents: find all photos tagged with a specific student
-- INCLUDE photo_id allows index-only scans for the join to photos
CREATE INDEX idx_pst_student_id ON photo_student_tags (student_id) INCLUDE (photo_id);

-- Lookup all tags for a specific photo (e.g., when displaying tagged students)
CREATE INDEX idx_pst_photo_id ON photo_student_tags (photo_id);

COMMENT ON TABLE photo_student_tags IS 'Maps photos to the students visible in them. Drives parent-facing privacy via RLS.';
COMMENT ON COLUMN photo_student_tags.tagged_by IS 'The teacher who tagged the student in the photo';
