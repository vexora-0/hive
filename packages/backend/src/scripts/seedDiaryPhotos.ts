/**
 * Give the demo child a *year*, so the diary has a journey to draw.
 *
 *   pnpm --filter @hive/backend seed:diary
 *   pnpm --filter @hive/backend seed:diary -- --clear   # remove these only
 *
 * ── Why this exists ──────────────────────────────────────────────────
 *
 * The same reason `seedFeedPhotos` exists, one screen along.
 *
 * `seedDemo` seeds six photographs and `seedFeedPhotos` adds twenty-two more
 * across four days of one week. Both are right for the wall, which is about
 * what arrived recently. The diary is about elapsed time: it draws one chapter
 * per month, a strand whose tick heights are those months' counts, and a day
 * number counted from the child's first photograph. With every photograph
 * inside a single week, all of that collapses — one chapter, no strand (it
 * hides itself below two months), and "Day 1" through "Day 5". Every part of
 * the screen that exists to show a journey was unreachable.
 *
 * This backdates photographs across roughly six months so the diary has months
 * to chapter, a strand with a shape, and a Day 172 to reach.
 *
 * ── What it is careful about ─────────────────────────────────────────
 *
 *  - **Deterministic ids** in a reserved `c2……` block. `seedDemo` owns `c0……`
 *    and `seedFeedPhotos` owns `c1……`, so all three can run together and
 *    re-running any of them updates its own rows rather than adding more.
 *  - **Backdated `created_at` at local noon.** The diary buckets days in the
 *    viewer's timezone; a photograph stamped midnight UTC lands on the previous
 *    day for anyone west of Greenwich and the demo's day numbering would not
 *    match its dates.
 *  - **Captions on some days.** The diary prints the day's first teacher note
 *    under the date, and that row is invisible in a dataset where nobody wrote
 *    one.
 *  - **`status` flips to `ready` last**, after tagging, because
 *    `notify_parents_on_photo` fires on that transition and reads
 *    `photo_student_tags`.
 *  - **Real processing**, via the same `processAndUploadPhoto` the upload
 *    endpoint uses, so these have genuine thumbnails, dimensions and
 *    blurhashes. Rows without them render as grey boxes.
 */

import 'dotenv/config';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadPhoto } from '../utils/imageProcessor';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See docs/environment-setup.md');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLEAR = process.argv.includes('--clear');
const ASSETS = join(__dirname, 'seed-assets');

// Mirrors seedDemo's fixed ids. Kept as literals rather than imported because
// that script is a program, not a module — importing it would run it.
const SCHOOL_BLOOM = 'a0000000-0000-4000-8000-000000000001';
const CLASS_BLOOM_A = 'd0000000-0000-4000-8000-000000000001';
const AARAV = 'e0000000-0000-4000-8000-000000000001';
const DIYA = 'e0000000-0000-4000-8000-000000000002';

/** Reserved id block. `c0……` is seedDemo, `c1……` is seedFeedPhotos. */
const ID_PREFIX = 'c2000000-0000-4000-8000-';

interface DiaryDay {
  daysAgo: number;
  count: number;
  /** The teacher's note. The diary prints the day's first one under the date. */
  caption?: string;
  /** Indices within the day that have the sibling in them too. */
  both?: number[];
}

/**
 * The child's six months, as a preschool actually looks.
 *
 * Uneven on purpose. A school year is not three photographs a week: it is a
 * quiet fortnight, then sports day, then nothing until the puppet show. The
 * strand plots these counts, so a flat schedule would draw a flat strand and
 * say nothing — the whole reason the strand is worth its space is that October
 * looks different from December at a glance.
 *
 * The gaps matter as much as the days. Day numbering counts **calendar days
 * elapsed**, not photographed days, so a fortnight with nothing in it still
 * advances the count — and that only shows up in a dataset that has one.
 */
const DAYS: readonly DiaryDay[] = [
  { daysAgo: 172, count: 2, caption: 'First morning at Bloom. Settled in by snack time.' },
  { daysAgo: 171, count: 3 },
  { daysAgo: 158, count: 4, both: [1] },
  { daysAgo: 141, count: 2, caption: 'Painting week — everything is blue this month.' },
  { daysAgo: 129, count: 3 },
  { daysAgo: 112, count: 5, caption: 'Sports day. Came third and did not mind at all.' },
  { daysAgo: 96, count: 2, both: [0] },
  { daysAgo: 83, count: 3 },
  { daysAgo: 68, count: 4, caption: 'Puppet show for the parents.' },
  { daysAgo: 51, count: 2 },
  { daysAgo: 38, count: 3, caption: 'Planting week in the garden bed.' },
  { daysAgo: 22, count: 4, both: [2] },
  { daysAgo: 11, count: 2, caption: 'Found the reading corner and stayed there.' },
];

const log = (m: string) => console.log(`  ${m}`);

/** Local noon `daysAgo` days back — see the note about day bucketing above. */
function stampFor(daysAgo: number, index: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // Spread within the school day, so a day's photographs are ordered and the
  // diary's time span ("9:15 – 11:40") is a real range rather than one instant.
  d.setHours(9 + Math.min(index, 6), 15 + index * 7, 0, 0);
  return d.toISOString();
}

async function clearAll(): Promise<void> {
  const { data, error } = await supabase
    .from('photos')
    .select('id')
    .like('id', `${ID_PREFIX}%`);
  if (error) throw new Error(`lookup: ${error.message}`);

  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) {
    log('nothing to clear');
    return;
  }
  await supabase.from('photo_student_tags').delete().in('photo_id', ids);
  await supabase.from('photos').delete().in('id', ids);
  log(`cleared ${ids.length} photographs`);
}

async function seed(): Promise<void> {
  if (!existsSync(ASSETS)) {
    console.error(`No seed-assets directory at ${ASSETS}`);
    process.exit(1);
  }
  const files = readdirSync(ASSETS).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (!files.length) {
    console.error('seed-assets is empty.');
    process.exit(1);
  }
  log(`${files.length} source images available`);

  // Two teachers, alternating by day. The diary names who was behind the
  // camera, and with one teacher that line is the same on every entry — which
  // is exactly the case where nobody notices it is wrong.
  const { data: teachers, error: teacherError } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', ['teacher.sarita@bloom.demo', 'teacher.dinesh@bloom.demo']);

  const teacherIds = (teachers ?? []).map((t) => t.id as string);
  if (teacherError || teacherIds.length === 0) {
    console.error('Could not find the Bloom teachers — run `pnpm seed` first.');
    process.exit(1);
  }

  let n = 0;
  let fileCursor = 0;

  for (const [dayIndex, day] of DAYS.entries()) {
    const teacherId = teacherIds[dayIndex % teacherIds.length];

    for (let i = 0; i < day.count; i++) {
      n += 1;
      const photoId = `${ID_PREFIX}${String(n).padStart(12, '0')}`;
      // Walk the assets rather than modulo the per-day index, so consecutive
      // photographs in a day are different pictures.
      const file = files[fileCursor % files.length];
      fileCursor += 1;

      const buffer = readFileSync(join(ASSETS, file));
      const key = `photos/${SCHOOL_BLOOM}/${CLASS_BLOOM_A}/${photoId}.jpg`;
      const createdAt = stampFor(day.daysAgo, i);
      // Only the first photograph of a day carries the note — that is the one
      // the diary prints, and a caption repeated five times reads as a bug.
      const caption = i === 0 ? (day.caption ?? null) : null;

      const { error: insertError } = await supabase.from('photos').upsert({
        id: photoId,
        school_id: SCHOOL_BLOOM,
        class_id: CLASS_BLOOM_A,
        uploaded_by: teacherId,
        s3_key: key,
        mime_type: 'image/jpeg',
        original_filename: file,
        caption,
        status: 'processing',
        created_at: createdAt,
      });
      if (insertError) throw new Error(`insert ${photoId}: ${insertError.message}`);

      const processed = await processAndUploadPhoto(buffer, key, 'image/jpeg');

      const { error: updateError } = await supabase
        .from('photos')
        .update({
          s3_key: processed.storagePath,
          thumbnail_s3_key: processed.thumbnailPath,
          width: processed.width,
          height: processed.height,
          blurhash: processed.blurhash,
          created_at: createdAt,
        })
        .eq('id', photoId);
      if (updateError) throw new Error(`metadata ${photoId}: ${updateError.message}`);

      const students = day.both?.includes(i) ? [AARAV, DIYA] : [AARAV];
      await supabase.from('photo_student_tags').upsert(
        students.map((studentId) => ({
          photo_id: photoId,
          student_id: studentId,
          tagged_by: teacherId,
        })),
        { onConflict: 'photo_id,student_id' },
      );

      // Last, so the notification trigger sees the tags. See the file header.
      await supabase.from('photos').update({ status: 'ready' }).eq('id', photoId);

      log(`day -${day.daysAgo}  ${i + 1}/${day.count}  ${file}`);
    }
  }

  const total = DAYS.reduce((a, d) => a + d.count, 0);
  const span = DAYS[0].daysAgo;
  console.log(
    `\n  ${total} photographs across ${DAYS.length} days, reaching back ${span} days.`,
  );
  console.log('  Sign in as parent.rajesh@bloom.demo and open the Diary tab.\n');
}

async function main(): Promise<void> {
  console.log(CLEAR ? '\nClearing diary photographs…\n' : '\nSeeding diary photographs…\n');
  if (CLEAR) {
    await clearAll();
    return;
  }
  await seed();
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
