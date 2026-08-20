import { describe, it, expect } from 'vitest';

import { localFields, monthBoundsUtc } from '../src/utils/diaryCalendar';

/**
 * The diary's calendar arithmetic.
 *
 * Pure, and deliberately tested without a database — the whole reason it was
 * lifted out of `feed.service.ts`. Every case below is a date a real family
 * would have, not a synthetic edge: a preschool morning, an evening pickup, the
 * turn of a month, the turn of a year.
 *
 * `tzOffsetMinutes` is `Date.prototype.getTimezoneOffset()` throughout, which
 * is **UTC minus local** — so India is `-330` and New York in winter is `300`.
 * Getting that sign backwards is the single easiest mistake in this module, and
 * several cases here fail loudly if it ever is.
 */
describe('localFields', () => {
  it('reads out the viewer\'s calendar, not the server\'s', () => {
    // 02:30 UTC is 08:00 in Bengaluru — the same school morning either way.
    expect(localFields('2024-03-04T02:30:00.000Z', -330)).toEqual({
      month: '2024-03',
      date: '2024-03-04',
    });
  });

  it('keeps an evening on its own day east of Greenwich', () => {
    // 18:00 UTC is half eleven at night in Bengaluru — still the 4th.
    expect(localFields('2024-03-04T18:00:00.000Z', -330)).toEqual({
      month: '2024-03',
      date: '2024-03-04',
    });
  });

  it('pulls a late instant back a day west of Greenwich', () => {
    // 01:00 UTC on the 5th is 20:00 on the 4th in New York.
    expect(localFields('2024-03-05T01:00:00.000Z', 300)).toEqual({
      month: '2024-03',
      date: '2024-03-04',
    });
  });

  it('moves the month boundary with the viewer', () => {
    const instant = '2024-04-01T00:30:00.000Z';

    // In UTC it is April.
    expect(localFields(instant, 0).month).toBe('2024-04');
    // One hour behind UTC it is half eleven at night on 31 March.
    expect(localFields(instant, 60).month).toBe('2024-03');
    // And in India it is six in the morning on 1 April.
    expect(localFields(instant, -330).date).toBe('2024-04-01');
  });

  it('moves the year boundary too', () => {
    const newYear = '2025-01-01T00:30:00.000Z';

    expect(localFields(newYear, 0).month).toBe('2025-01');
    expect(localFields(newYear, 60)).toEqual({
      month: '2024-12',
      date: '2024-12-31',
    });
  });

  it('zero-pads single-digit months and days', () => {
    // '2024-1-5' would sort wrongly as a string key and would not match the
    // `YYYY-MM` the route param accepts.
    expect(localFields('2024-01-05T12:00:00.000Z', 0)).toEqual({
      month: '2024-01',
      date: '2024-01-05',
    });
  });

  it('handles a timestamp carrying microseconds, as Postgres emits them', () => {
    // `timestamptz` keeps microseconds; the feed's cursor validator exists
    // because of it. Date.parse truncates to milliseconds, which is fine here —
    // it cannot change which day an instant falls on.
    expect(localFields('2024-03-04T02:30:00.123456+00:00', -330).date).toBe(
      '2024-03-04',
    );
  });
});

describe('monthBoundsUtc', () => {
  it('brackets a month in UTC for a viewer in UTC', () => {
    expect(monthBoundsUtc('2024-03', 0)).toEqual({
      start: '2024-03-01T00:00:00.000Z',
      end: '2024-04-01T00:00:00.000Z',
    });
  });

  it('shifts the window to the viewer\'s midnight', () => {
    // Midnight on 1 March in Bengaluru is 18:30 on 29 February UTC.
    expect(monthBoundsUtc('2024-03', -330)).toEqual({
      start: '2024-02-29T18:30:00.000Z',
      end: '2024-03-31T18:30:00.000Z',
    });
  });

  it('rolls December over into the next January', () => {
    expect(monthBoundsUtc('2024-12', 0)).toEqual({
      start: '2024-12-01T00:00:00.000Z',
      end: '2025-01-01T00:00:00.000Z',
    });
  });

  it('spans a leap February correctly', () => {
    const { start, end } = monthBoundsUtc('2024-02', 0);
    expect(start).toBe('2024-02-01T00:00:00.000Z');
    // 29 days, not 28. A hand-rolled month length would get this wrong.
    expect((Date.parse(end) - Date.parse(start)) / 86_400_000).toBe(29);
  });

  /**
   * The property the whole scheme rests on: consecutive chapters tile the
   * timeline with no gap and no overlap, so every photograph belongs to exactly
   * one month. A half-open interval is what buys that, and it is why the
   * service filters `gte(start)` and `lt(end)` rather than `lte`.
   */
  it('tiles consecutive months with no gap and no overlap', () => {
    for (const offset of [0, -330, 300, 720, -840]) {
      const march = monthBoundsUtc('2024-03', offset);
      const april = monthBoundsUtc('2024-04', offset);
      expect(march.end).toBe(april.start);
    }
  });

  /**
   * The bounds and the bucketing have to be the same function read in two
   * directions. If they ever disagree, a photograph is fetched by one month's
   * query and then labelled with another month's key — which is invisible in
   * the middle of a month and wrong at both ends of every single one.
   */
  it('agrees with localFields at both ends of the window', () => {
    for (const offset of [0, -330, 300]) {
      const { start, end } = monthBoundsUtc('2024-03', offset);

      // The first instant inside the window is in March.
      expect(localFields(start, offset).month).toBe('2024-03');
      // The last one still is: `end` is exclusive, so step back a millisecond.
      const lastInside = new Date(Date.parse(end) - 1).toISOString();
      expect(localFields(lastInside, offset).month).toBe('2024-03');
      // And `end` itself has already turned over.
      expect(localFields(end, offset).month).toBe('2024-04');
    }
  });
});
