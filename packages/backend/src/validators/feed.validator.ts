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

/**
 * The viewer's UTC offset, as `Date.prototype.getTimezoneOffset()` reports it:
 * **UTC minus local, in minutes**, so India Standard Time is `-330`.
 *
 * The diary buckets photographs into months and days, and which day a
 * photograph belongs to is a question about the *parent's* calendar, not the
 * server's. Sending the offset is the whole of what makes that possible.
 *
 * Bounded by the widest real offsets in use — UTC-12:00 (Baker Island) to
 * UTC+14:00 (Line Islands) — which keeps a malformed value from shifting a
 * month boundary somewhere absurd. Defaults to 0 so a caller that omits it gets
 * UTC bucketing rather than a 400.
 */
const tzOffset = z.coerce
  .number()
  .int('tzOffset must be a whole number of minutes')
  .min(-14 * 60, 'tzOffset is out of range')
  .max(12 * 60, 'tzOffset is out of range')
  .default(0);

/**
 * Query for the diary outline.
 *
 * `studentId` is required here where the feed leaves it optional, and that is a
 * product fact rather than an oversight: a feed may merge siblings, but a
 * journey belongs to one child. Two children's photographs interleaved into one
 * timeline would be a diary of neither.
 */
export const getDiarySchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  tzOffset,
});

export type GetDiaryInput = z.infer<typeof getDiarySchema>;

/** Query for one chapter. Same shape — the month arrives as a path param. */
export const getDiaryChapterQuery = getDiarySchema;

/**
 * `GET /feed/diary/:month`.
 *
 * `YYYY-MM`, with the month field constrained to 01–12 so the value can be split
 * and handed to `Date.UTC` without a second validation pass. The year floor
 * keeps two-digit-year mapping (`Date.UTC(99, …)` is 1999) out of reach.
 */
export const diaryMonthParam = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM')
    .refine((value) => Number(value.slice(0, 4)) >= 1970, {
      message: 'month must be YYYY-MM',
    }),
});

export type DiaryMonthParam = z.infer<typeof diaryMonthParam>;
