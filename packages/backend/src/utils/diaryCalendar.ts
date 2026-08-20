/**
 * The diary's calendar arithmetic.
 *
 * Which day a photograph belongs to is a question about the **viewer's** clock,
 * not the server's. A backend container runs in whatever timezone it was
 * started in — usually UTC — and a school day in Bengaluru, Auckland or São
 * Paulo does not line up with it. Bucketing in UTC would file a late afternoon
 * under the next day for anyone far enough west, and it would disagree with the
 * mobile feed, which groups its own day headers in device time. Two screens
 * dating the same photograph differently is the kind of defect nobody reports
 * and everybody notices.
 *
 * So the client sends its offset and every boundary is computed against it.
 *
 * These live here rather than inside `feed.service.ts` because they are pure,
 * they are the part of the diary most easily got wrong, and being pure they can
 * be tested without a database — the same reason `cursor.ts` is its own module.
 */

/** One minute, in milliseconds. Named because the offset maths is dense. */
const MINUTE_MS = 60_000;

export interface LocalFields {
  /** `YYYY-MM` in the viewer's calendar. */
  month: string;
  /** `YYYY-MM-DD` in the viewer's calendar. */
  date: string;
}

/**
 * The viewer's wall-clock fields for an instant.
 *
 * `tzOffsetMinutes` is `Date.prototype.getTimezoneOffset()`, i.e. **UTC minus
 * local** in minutes — so India Standard Time is `-330`, not `330`. Subtracting
 * it shifts the instant onto the viewer's clock, after which the `getUTC*`
 * accessors read out local calendar fields.
 *
 * Reading the *local* accessors instead would give the server's timezone, which
 * is the bug this module exists to prevent.
 */
export function localFields(iso: string, tzOffsetMinutes: number): LocalFields {
  const shifted = new Date(Date.parse(iso) - tzOffsetMinutes * MINUTE_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return { month: `${year}-${month}`, date: `${year}-${month}-${day}` };
}

/**
 * The UTC half-open interval `[start, end)` covering a local month.
 *
 * The inverse of {@link localFields}: a local wall-clock instant plus the offset
 * is the UTC instant. Half-open rather than inclusive, so a photograph taken in
 * the first millisecond of a month cannot land in two chapters — and so the
 * bounds compose: consecutive months tile the timeline with no gap and no
 * overlap.
 *
 * `month` must be `YYYY-MM` with a real month field; the route validator
 * guarantees that before this is reached.
 */
export function monthBoundsUtc(
  month: string,
  tzOffsetMinutes: number,
): { start: string; end: string } {
  const [year, monthIndex] = month.split('-').map(Number);

  // `Date.UTC` rolls December over into the next January on its own, so the
  // year does not need special-casing at the boundary.
  const startLocal = Date.UTC(year, monthIndex - 1, 1);
  const endLocal = Date.UTC(year, monthIndex, 1);

  return {
    start: new Date(startLocal + tzOffsetMinutes * MINUTE_MS).toISOString(),
    end: new Date(endLocal + tzOffsetMinutes * MINUTE_MS).toISOString(),
  };
}
