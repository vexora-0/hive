/**
 * Top up the demo feed so the parent wall has enough photographs to look like
 * a wall.
 *
 *   pnpm --filter @hive/backend seed:feed
 *   pnpm --filter @hive/backend seed:feed -- --clear   # remove these only
 *
 * ── Why this exists ──────────────────────────────────────────────────
 *
 * `seedDemo` creates **six** photographs across two schools, which is right
 * for what it is for: it exercises the privacy boundary, sibling dedup and the
 * ordering flow with the smallest dataset that can. What it cannot do is show
 * the parent feed, because the feed lays a day out according to how many
 * photographs that day has — one photograph is a single full-width print, two
 * are a pair — and with six photographs spread over two schools and several
 * days, no day ever holds more than two. Every composed spread the wall knows
 * how to draw was unreachable, so the feed rendered as a column of one-ups and
 * looked like it had no design in it at all.
 *
 * This adds photographs to **one parent's children on specific days**, with the
 * counts chosen so the wall has to use every template it has.
 *
 * ── What it is careful about ─────────────────────────────────────────
 *
 *  - **Deterministic ids.** Re-running updates the same rows instead of adding
 *    another twenty. `seedDemo` learned this the hard way with
 *    `crypto.randomUUID()`; the ids here are in a reserved `c1……` block that
 *    cannot collide with the `c0……` block `seedDemo` owns.
 *  - **Backdated `created_at`.** The feed buckets by day in the device's
 *    timezone, so the dates are set at local noon — a photo stamped midnight
 *    UTC lands on the previous day for anyone west of Greenwich and the day
 *    grouping in the demo would not match the day headers.
 *  - **`status` flips to `ready` last**, after tagging, because
 *    `notify_parents_on_photo` fires on that transition and reads
 *    `photo_student_tags`. Flipping first produces photographs nobody is
 *    notified about.
 *  - **Real processing.** Uses the same `processAndUploadPhoto` the upload
 *    endpoint uses, so these have genuine thumbnails, dimensions and
 *    blurhashes. Rows without them render as grey boxes in the wall.
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

/** Reserved id block. `seedDemo` owns `c0……`; this owns `c1……`. */
const ID_PREFIX = 'c1000000-0000-4000-8000-';

/**
 * How many photographs land on each day, and who is in them.
 *
 * The counts are the point. Seven, five, six and four make the wall use its
 * full-width opener, both orientations of the asymmetric duo, the even pair and
 * the tilted trio — and because the template cursor carries across days, no two
 * of these days open the same way. Four days so the feed has something to
 * scroll and a sticky day header to pin.
 *
 * `both` marks a photograph with the siblings in it, which is also the case
 * that exercises feed dedup: it must appear **once** under "All", not twice.
 */
const DAYS: readonly { daysAgo: number; count: number; both: number[] }[] = [
  { daysAgo: 0, count: 7, both: [1, 4] },
  { daysAgo: 1, count: 5, both: [2] },
  { daysAgo: 2, count: 6, both: [0, 3] },
  { daysAgo: 4, count: 4, both: [1] },
];

const log = (m: string) => console.log(`  ${m}`);

/** Local noon `daysAgo` days back — see the note about day bucketing. */
function stampFor(daysAgo: number, index: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // Spread within the school day so the ordering inside a day is stable and
  // looks like a day rather than like a bulk import at one instant.
  d.setHours(9 + Math.min(index, 7), 15 + index * 5, 0, 0);
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

  // The teacher who "took" them. Resolved by email rather than hardcoded,
  // because auth user ids are assigned by Supabase and cannot be fixed.
  const { data: teacher, error: teacherError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'teacher.sarita@bloom.demo')
    .single();
  if (teacherError || !teacher) {
    console.error(
      'Could not find teacher.sarita@bloom.demo — run `pnpm seed` first.',
    );
    process.exit(1);
  }
  const teacherId = teacher.id as string;

  let n = 0;
  let fileCursor = 0;

  for (const day of DAYS) {
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

      const { error: insertError } = await supabase.from('photos').upsert({
        id: photoId,
        school_id: SCHOOL_BLOOM,
        class_id: CLASS_BLOOM_A,
        uploaded_by: teacherId,
        s3_key: key,
        mime_type: 'image/jpeg',
        original_filename: file,
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

      const students = day.both.includes(i) ? [AARAV, DIYA] : [AARAV];
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

      log(
        `day -${day.daysAgo}  ${i + 1}/${day.count}  ${file}  ` +
          `${students.length === 2 ? 'Aarav + Diya' : 'Aarav'}`,
      );
    }
  }

  const total = DAYS.reduce((a, d) => a + d.count, 0);
  console.log(`\n  ${total} photographs across ${DAYS.length} days.`);
  console.log('  Sign in as parent.rajesh@bloom.demo to see the wall.\n');
}

async function main(): Promise<void> {
  console.log(CLEAR ? '\nClearing feed photographs…\n' : '\nSeeding feed photographs…\n');
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
