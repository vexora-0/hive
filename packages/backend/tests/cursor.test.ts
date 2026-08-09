import { describe, it, expect } from 'vitest';

import { encodeCursor, decodeCursor } from '../src/utils/cursor';
import { AppError } from '../src/middleware/errorHandler';

// ---------------------------------------------------------------------------
// Keyset cursors must round-trip a timestamptz exactly
// ---------------------------------------------------------------------------

/**
 * `created_at` is `timestamptz`; Postgres stores microseconds and PostgREST
 * emits all six digits. The decoded value is interpolated straight into the
 * `created_at.lt.…` / `created_at.eq.…` filter, so anything less than a
 * byte-identical round trip silently drops rows at every page boundary.
 */
describe('cursor: microsecond precision survives encode -> decode', () => {
  const MICROSECOND_TS = '2026-08-09T12:00:00.123456+00:00';
  const ID = '3f2b1a44-9c7e-4d21-8b55-0a1c2d3e4f60';

  it('returns the timestamp byte-identical to what Postgres emitted', () => {
    const decoded = decodeCursor(encodeCursor(MICROSECOND_TS, ID));

    expect(decoded.createdAt).toBe(MICROSECOND_TS);
    expect(decoded.id).toBe(ID);
  });

  it('does not truncate to millisecond precision', () => {
    // The regression: `new Date(v).toISOString()` yields
    // '2026-08-09T12:00:00.123Z', which is strictly less than every row in the
    // .123456 window, so `created_at.lt.<that>` skips them all.
    const decoded = decodeCursor(encodeCursor(MICROSECOND_TS, ID));

    expect(decoded.createdAt).not.toBe(new Date(MICROSECOND_TS).toISOString());
    expect(decoded.createdAt).toContain('.123456');
  });

  it('keeps the equality tie-break matchable for rows written in one transaction', () => {
    // notify_parents_on_photo inserts one notification per tagged parent inside
    // a single transaction, and `now()` is the transaction timestamp, so those
    // rows share a byte-identical created_at. A page boundary inside the group
    // relies on `and(created_at.eq.<cursor>, id.lt.<id>)` to return the rest.
    // If the cursor were re-serialised, no stored row could ever equal it.
    const storedCreatedAt = '2026-08-09T12:00:00.987654+00:00';

    const decoded = decodeCursor(encodeCursor(storedCreatedAt, ID));

    expect(decoded.createdAt).toBe(storedCreatedAt);
  });

  it.each([
    ['microseconds, Z suffix', '2026-08-09T12:00:00.123456Z'],
    ['microseconds, +00:00 offset', '2026-08-09T12:00:00.123456+00:00'],
    ['microseconds, +05:30 offset', '2026-08-09T17:30:00.000001+05:30'],
    ['nanoseconds', '2026-08-09T12:00:00.123456789+00:00'],
    ['milliseconds', '2026-08-09T12:00:00.123+00:00'],
    ['whole seconds — Postgres drops a zero fraction', '2026-08-09T12:00:00+00:00'],
    ['no offset', '2026-08-09T12:00:00.123456'],
  ])('round-trips %s unchanged', (_name, timestamp) => {
    expect(decodeCursor(encodeCursor(timestamp, ID)).createdAt).toBe(timestamp);
  });
});

// ---------------------------------------------------------------------------
// The validation that motivated re-serialising must still hold
// ---------------------------------------------------------------------------

/**
 * The decoded values are interpolated into a PostgREST `or()` expression, where
 * commas and parentheses are structural. Validating in place has to reject
 * everything the old `new Date(...)` rewrite neutralised.
 */
describe('cursor: rejects anything that could carry filter structure', () => {
  const ID = '3f2b1a44-9c7e-4d21-8b55-0a1c2d3e4f60';

  function cursorFor(payload: unknown): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  const bad: Array<[string, unknown]> = [
    ['comma — closes the or() operand', { createdAt: '2026-08-09T12:00:00Z,id.gt.0', id: ID }],
    ['parenthesis — opens a nested group', { createdAt: '2026-08-09T12:00:00Z)', id: ID }],
    ['trailing filter fragment', { createdAt: '2026-08-09T12:00:00Z&select=*', id: ID }],
    ['loose date string Date.parse would accept', { createdAt: 'Aug 9 2026', id: ID }],
    ['impossible calendar date', { createdAt: '2026-13-45T99:99:99Z', id: ID }],
    ['not a string', { createdAt: 1786000000000, id: ID }],
    ['missing createdAt', { id: ID }],
    ['non-UUID id', { createdAt: '2026-08-09T12:00:00.123456+00:00', id: 'abc' }],
    ['id carrying structure', { createdAt: '2026-08-09T12:00:00.123456+00:00', id: `${ID},x.y.z` }],
  ];

  it.each(bad)('rejects %s with a 400', (_name, payload) => {
    expect(() => decodeCursor(cursorFor(payload))).toThrow(AppError);
    try {
      decodeCursor(cursorFor(payload));
    } catch (err) {
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe('INVALID_CURSOR');
    }
  });

  it.each([
    ['not base64', '!!!not-base64!!!'],
    ['valid base64 of a JSON scalar', Buffer.from('"123"').toString('base64url')],
    ['valid base64 of a JSON array', Buffer.from('[]').toString('base64url')],
    ['valid base64 of non-JSON', Buffer.from('hello').toString('base64url')],
  ])('rejects %s with a 400', (_name, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(AppError);
  });
});
