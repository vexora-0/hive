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
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Cursor {
  createdAt: string;
  id: string;
}

export interface NotificationCursor extends Cursor {
  is_read: boolean;
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
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }
  // Re-serialise rather than trusting the input text: this is what reaches the
  // filter expression, and it can now only be an ISO-8601 instant.
  return new Date(value).toISOString();
}

function assertUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }
  return value;
}

/** Decode a `(created_at, id)` keyset cursor. */
export function decodeCursor(cursor: string): Cursor {
  const raw = parse(cursor);
  return {
    createdAt: assertTimestamp(raw.createdAt),
    id: assertUuid(raw.id),
  };
}

/**
 * Decode the notification cursor, which sorts unread-first and so carries the
 * `is_read` flag as the leading key.
 */
export function decodeNotificationCursor(cursor: string): NotificationCursor {
  const raw = parse(cursor);
  if (typeof raw.is_read !== 'boolean') {
    throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
  }
  return {
    createdAt: assertTimestamp(raw.createdAt),
    id: assertUuid(raw.id),
    is_read: raw.is_read,
  };
}

/** Encode a `(created_at, id)` keyset cursor. */
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}
