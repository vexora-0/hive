/**
 * The diary's words.
 *
 * Every label on the timeline is built here rather than inside a component, for
 * two reasons. The screen shows the same date in three sizes — a strand tick, a
 * chapter heading, a day line — and they have to agree. And every one of these
 * takes a **calendar key** (`YYYY-MM`, `YYYY-MM-DD`) rather than an instant:
 * the server has already decided which day a photograph belongs to, in the
 * parent's own timezone, and re-deriving that from a timestamp on the client is
 * how the two ends start disagreeing about what "Tuesday" means.
 */

/**
 * Midnight, locally, for a `YYYY-MM-DD` key.
 *
 * `new Date('2026-03-04')` is parsed as **UTC** midnight by the spec, so east
 * of Greenwich it formats as the 4th and west of it as the 3rd. Splitting the
 * fields and handing them to the local constructor is the only reading that
 * gives back the day the key names.
 */
function localMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The first of the month, locally, for a `YYYY-MM` key. */
function localMonthStart(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

const MS_PER_DAY = 86_400_000;

/**
 * "March 2026" — or just "March" when it is this year, because the year is
 * then the one thing on the line carrying no information.
 */
export function monthLabel(monthKey: string): string {
  const date = localMonthStart(monthKey);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Mar" — the strand's tick label, where a full month name will not fit. */
export function monthShort(monthKey: string): string {
  return localMonthStart(monthKey).toLocaleDateString(undefined, {
    month: 'short',
  });
}

/** "2026" — drawn under a tick only where the year turns over. */
export function monthYear(monthKey: string): string {
  return String(localMonthStart(monthKey).getFullYear());
}

/** True when a chapter opens a year the previous one did not. */
export function startsNewYear(monthKey: string, previous?: string): boolean {
  if (!previous) return true;
  return monthKey.slice(0, 4) !== previous.slice(0, 4);
}

/**
 * A day's name: relative where a parent thinks relatively, absolute after that.
 *
 * The same rule the wall uses for its day headers, so the two screens never
 * name the same Tuesday differently.
 */
export function dayLabel(dateKey: string): string {
  const date = localMidnight(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * How far into the journey a day sits, counted in **calendar days from the
 * first photograph**, inclusive — so the first day is Day 1.
 *
 * Deliberately not "the nth day that has photographs". A parent reading "Day
 * 84" is asking how long their child has been at school, not how many times a
 * teacher happened to pick up a phone; counting only photographed days would
 * make a quiet fortnight vanish from the child's history.
 *
 * Returns null when the journey has no start yet, so a caller renders nothing
 * rather than "Day NaN".
 */
export function dayNumber(dateKey: string, firstPhotoAt: string | null): number | null {
  if (!firstPhotoAt) return null;

  const start = new Date(firstPhotoAt);
  const startMidnight = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );

  const elapsed = localMidnight(dateKey).getTime() - startMidnight.getTime();
  if (Number.isNaN(elapsed)) return null;

  return Math.floor(elapsed / MS_PER_DAY) + 1;
}

/**
 * The length of the journey so far, in whole days, inclusive of both ends.
 *
 * Null rather than 0 when there is nothing yet: "0 days" is a claim about a
 * child who simply has not been photographed, and the screen has a better
 * sentence for that case.
 */
export function journeyLength(
  firstPhotoAt: string | null,
  lastPhotoAt: string | null,
): number | null {
  if (!firstPhotoAt || !lastPhotoAt) return null;

  const start = new Date(firstPhotoAt);
  const end = new Date(lastPhotoAt);
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const days = Math.floor(
    (endMidnight.getTime() - startMidnight.getTime()) / MS_PER_DAY,
  );
  return Number.isNaN(days) ? null : days + 1;
}

/** "4 March 2026" — the date under a terminus, written out in full. */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "9 photos", "1 photo". Counting is done in enough places to be worth this. */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** First name only — a timeline line has no room for a family name. */
export function firstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0];
}

/**
 * Who was behind the camera that day.
 *
 * One teacher is named; two or more are counted, because a line that lists
 * three names stops being scannable. Nobody named at all — a deleted account —
 * and the clause is left out rather than printed as "by someone".
 */
export function teacherLabel(names: string[]): string | undefined {
  const firsts = names.map((n) => firstName(n)).filter((n): n is string => Boolean(n));
  if (firsts.length === 0) return undefined;
  if (firsts.length === 1) return firsts[0];
  return `${firsts[0]} +${firsts.length - 1}`;
}
