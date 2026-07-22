import { z } from 'zod';

/**
 * Body for POST /schools/:id/classes.
 *
 * `school_id` is not accepted from the body — it comes from the route
 * parameter, which `assertSchoolAccess` has already checked the caller against.
 * Taking it from the body would let an admin-scoped request create a class
 * under a school the URL never named.
 */
export const createClassSchema = z.object({
  name: z.string().min(1, 'name is required'),
  grade: z.string().optional(),
  academicYear: z.string().optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
