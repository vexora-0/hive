import { z } from 'zod';

/**
 * Path-parameter schemas.
 *
 * `validate` has always supported `'params'`, but no route used it, so a
 * malformed `:id` went straight to Postgres and came back as an unhandled
 * driver error — a 500 where the caller sent bad input. `/notifications/:id/read`
 * carries no roleGuard, so any authenticated user could trigger one at will.
 *
 * Only applied where the service does not already establish existence and
 * ownership: routes that look the resource up and return 404 (photo detail,
 * order detail, photo tag/confirm) reject a bad ID correctly on their own.
 */

export const uuidIdParam = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export const uuidStudentIdParam = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
});

export const uuidUserIdParam = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const uuidClassIdParam = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
});

export const uuidStudentAndParentParams = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  parentId: z.string().uuid('parentId must be a valid UUID'),
});

export const uuidClassAndStudentParams = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
  studentId: z.string().uuid('studentId must be a valid UUID'),
});

/**
 * `DELETE /photos/:id/tag/:studentId`.
 *
 * Both IDs reach a `.eq()` filter on `photo_student_tags`, and unlike the
 * tag/confirm routes there is no prior lookup that would turn a malformed one
 * into a clean 404 — `assertPhotoAccess` runs on `:id` only.
 */
export const uuidPhotoAndStudentParams = z.object({
  id: z.string().uuid('id must be a valid UUID'),
  studentId: z.string().uuid('studentId must be a valid UUID'),
});
