import { describe, it, expect } from 'vitest';

import {
  dayLabel,
  dayNumber,
  firstName,
  journeyLength,
  plural,
  startsNewYear,
  teacherLabel,
} from '@/features/parent/utils/diaryFormat';

/**
 * The diary's words.
 *
 * Locale-dependent output — the weekday and month names — is deliberately not
 * asserted here: `toLocaleDateString(undefined, …)` answers to whatever the
 * device is set to, and pinning it to en-US would test Node's ICU data rather
 * than this module. What is asserted is everything that has to be true in every
 * locale: the day count, the journey length, the relative names, and the
 * boundary behaviour that made those worth extracting.
 */

/** `YYYY-MM-DD` for a day `offset` days from today, in the local calendar. */
function dateKey(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** An instant at midday, `offset` days from today. Midday avoids DST cliffs. */
function instant(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

describe('dayNumber', () => {
  /**
   * The journey starts at Day 1, not Day 0.
   *
   * A parent reading their child's first entry expects the first day of school
   * to be the first day, and an off-by-one here would be visible on the single
   * most-looked-at row of the whole screen.
   */
  it('counts the first day as Day 1', () => {
    expect(dayNumber(dateKey(0), instant(0))).toBe(1);
  });

  it('counts calendar days elapsed, not photographed days', () => {
    // Ten days after the first photograph is Day 11, whether or not anything
    // was taken on the nine days between. A quiet fortnight must not vanish
    // from a child's history.
    expect(dayNumber(dateKey(0), instant(-10))).toBe(11);
  });

  it('is unaffected by the time of day the journey started', () => {
    const start = new Date();
    start.setDate(start.getDate() - 3);

    const dawn = new Date(start);
    dawn.setHours(0, 5, 0, 0);
    const dusk = new Date(start);
    dusk.setHours(23, 55, 0, 0);

    // Both are the same calendar day, so both put today on Day 4. Comparing
    // raw instants rather than midnights would answer 3 for one of them.
    expect(dayNumber(dateKey(0), dawn.toISOString())).toBe(4);
    expect(dayNumber(dateKey(0), dusk.toISOString())).toBe(4);
  });

  it('returns null rather than a number when there is no journey yet', () => {
    expect(dayNumber(dateKey(0), null)).toBeNull();
  });
});

describe('journeyLength', () => {
  it('counts both ends', () => {
    // First photograph today, latest today: one day, not zero.
    expect(journeyLength(instant(0), instant(0))).toBe(1);
    expect(journeyLength(instant(-6), instant(0))).toBe(7);
  });

  it('is null when either end is missing', () => {
    expect(journeyLength(null, instant(0))).toBeNull();
    expect(journeyLength(instant(0), null)).toBeNull();
  });
});

describe('dayLabel', () => {
  /**
   * The same rule the wall's day headers use — relative where a parent thinks
   * relatively. The two screens must never name the same Tuesday differently.
   */
  it('names today and yesterday relatively', () => {
    expect(dayLabel(dateKey(0))).toBe('Today');
    expect(dayLabel(dateKey(-1))).toBe('Yesterday');
  });

  it('names anything older absolutely', () => {
    expect(dayLabel(dateKey(-9))).not.toBe('Today');
    expect(dayLabel(dateKey(-9))).not.toBe('Yesterday');
  });

  /**
   * `new Date('2024-03-04')` is parsed as **UTC** midnight by the spec, so east
   * of Greenwich it formats as the 4th and west of it as the 3rd. The module
   * splits the key and uses the local constructor instead; this is the case
   * that would catch a regression back to the one-argument form.
   */
  it('reads a date key as a local day, not a UTC instant', () => {
    // Whatever the machine's timezone, today's key must name today.
    expect(dayLabel(dateKey(0))).toBe('Today');
  });
});

describe('startsNewYear', () => {
  it('is true for the first chapter, which has nothing before it', () => {
    expect(startsNewYear('2024-03', undefined)).toBe(true);
  });

  it('is true only where the year turns over', () => {
    expect(startsNewYear('2024-04', '2024-03')).toBe(false);
    expect(startsNewYear('2025-01', '2024-12')).toBe(true);
  });
});

describe('plural', () => {
  it('agrees with its count', () => {
    expect(plural(1, 'photo')).toBe('1 photo');
    expect(plural(2, 'photo')).toBe('2 photos');
    expect(plural(0, 'photo')).toBe('0 photos');
  });

  it('takes an irregular plural when the default will not do', () => {
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(3, 'day')).toBe('3 days');
  });
});

describe('firstName', () => {
  it('takes the first word only', () => {
    expect(firstName('Priya Nair')).toBe('Priya');
    expect(firstName('  Aarav   Sharma ')).toBe('Aarav');
  });

  it('is undefined for a name that is not there', () => {
    expect(firstName(null)).toBeUndefined();
    expect(firstName(undefined)).toBeUndefined();
  });
});

describe('teacherLabel', () => {
  it('names one teacher and counts the rest', () => {
    expect(teacherLabel(['Priya Nair'])).toBe('Priya');
    expect(teacherLabel(['Priya Nair', 'Meera Rao'])).toBe('Priya +1');
    expect(teacherLabel(['Priya Nair', 'Meera Rao', 'Sarita Devi'])).toBe('Priya +2');
  });

  /**
   * A deleted account arrives as a null name. The clause is left out rather
   * than printed as "by someone", so a caller can drop it from the line.
   */
  it('is undefined when nobody can be named', () => {
    expect(teacherLabel([])).toBeUndefined();
  });
});
