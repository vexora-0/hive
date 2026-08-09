import { AppError } from '../middleware/errorHandler';

/**
 * Keyset pagination cursors.
 *
 * Every paginated endpoint used to inline this:
 *
 *   const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
 *   query.or(`created_at.lt.${decoded.createdAt},…`)
 *
 * wrapped in a `try` that caught only the parse. Two problems followed from
 * that. A cursor decoding to valid JSON of the wrong shape — `"123"` is a
 * complete JSON document — parsed cleanly and put the string `undefined` into
 * the filter, which PostgREST rejected as a 500 rather than the 400 the caller
 * had earned. And because the decoded values are interpolated into a filter
 * expression rather than bound as parameters, whatever they contained became
 * part of that expression: commas and parentheses are structural in PostgREST's
 * `or()` grammar.
 *
 * Validating the shape here fixes both. The values are still interpolated —
 * that is how the filter grammar works — but they can now only be a UUID and
 * an ISO timestamp, neither of which can carry structure.
 *
 * The validation must not *rewrite* the timestamp, only accept or reject it.
 * See ISO_TIMESTAMP_RE below.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ISO-8601 instant with optional fractional seconds, matched in place.
 *
 * This deliberately validates the caller's string rather than round-tripping it
 * through `Date`. `new Date(v).toISOString()` truncates to milliseconds, but
 * `created_at` is `timestamptz` and Postgres stores microseconds, so the
 * re-serialised value was not the value the row holds. Two things broke:
 *
 *   - `created_at.lt.<truncated>` sits *before* the rows in the truncated
 *     microsecond window, so those rows are skipped at the page boundary and
 *     never appear on any page.
 *   - The tie-break `and(created_at.eq.<truncated>, id.lt.<id>)` can never
 *     match, because no stored row equals a truncated timestamp. That branch
 *     exists for rows written in one transaction — `notify_parents_on_photo`
 *     inserts a notification per tagged parent and `now()` is the transaction
 *     timestamp, so they share a byte-identical `created_at`. A page boundary
 *     landing inside such a group dropped the rest of the group for good.
 *
 * Fractional digits are capped at 9 and the date/time fields are fixed-width,
 * so the matched string is bounded and contains no comma, parenthesis or dot
 * that PostgREST's `or()` grammar would read as structure.
 */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?$/;

export interface Cursor {
  createdAt: string;
  id: string;
}

function parse(cursor: string): Record<string, unknown> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }

  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }

  return decoded as Record<string, unknown>;
}

function assertTimestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !ISO_TIMESTAMP_RE.test(value) ||
    // Catches strings the pattern admits but no calendar does, e.g. month 19.
    Number.isNaN(Date.parse(value))
  ) {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }
  // Returned verbatim. The filter compares against a stored `timestamptz`, so
  // this has to be byte-identical to what Postgres emitted — see
  // ISO_TIMESTAMP_RE for what re-serialising cost.
  return value;
}

function assertUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }
  return value;
}

/**
 * Decode a `(created_at, id)` keyset cursor.
 *
 * Extra keys are ignored rather than rejected. Notifications used to sort
 * unread-first and mint a cursor with `is_read` as the leading key; they no
 * longer do, and a client mid-scroll when the change shipped is still holding
 * one of those cursors. Ignoring the field lets that scroll finish instead of
 * answering 400.
 */
export function decodeCursor(cursor: string): Cursor {
  const raw = parse(cursor);
  return {
    createdAt: assertTimestamp(raw.createdAt),
    id: assertUuid(raw.id),
  };
}

/** Encode a `(created_at, id)` keyset cursor. */
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}
