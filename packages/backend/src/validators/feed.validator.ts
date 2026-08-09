import { z } from 'zod';

/**
 * Query for the parent feed.
 *
 * The feed routes carried no validator at all: `studentId` went straight from
 * the query string into a `.eq('student_id', …)` filter, so a malformed value
 * came back as a 500 from PostgREST rather than a 400. The limit was parsed by
 * hand in the controller; doing it here keeps the clamping in one place and
 * out of the request handler.
 */
export const getFeedSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID').optional(),
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must not exceed 50')
    .default(20),
});

export type GetFeedInput = z.infer<typeof getFeedSchema>;
