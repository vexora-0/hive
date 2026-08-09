import 'dotenv/config';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll } from 'vitest';

// .env.test overrides .env — tests must never touch the development or demo
// project, because the harness deletes the rows and auth users it creates.
config({ path: '.env.test', override: true });

const TEST_URL = process.env.SUPABASE_URL;
const TEST_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!TEST_URL || !TEST_KEY) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in packages/backend/.env.test.\n' +
      'See docs/environment-setup.md — the test project must be SEPARATE from development.',
  );
}

/**
 * Refuse to run against the development project.
 *
 * The suite truncates every domain table. Pointing it at the project holding
 * the demo dataset would wipe the data you are about to present, and it would
 * happen silently. This guard is deliberately loud and unconditional.
 */
const devUrl = process.env.DEV_SUPABASE_URL;
if (devUrl && devUrl === TEST_URL) {
  throw new Error(
    `REFUSING TO RUN: .env.test points at the same Supabase project as .env (${TEST_URL}).\n` +
      'The test suite truncates tables. Create a separate project first.',
  );
}

/**
 * Second guard, for the case the one above cannot cover.
 *
 * The check above only fires when DEV_SUPABASE_URL happens to be set, so it is
 * silent on a machine that never configured it — which is exactly the machine
 * most likely to get this wrong.
 *
 * Hard-coded on purpose: a guard that reads the value it is guarding against
 * from configuration guards nothing.
 *
 * `udawaiykfvdcvcouiqxr` is the project this guard exists for — it holds the
 * demo dataset. It was missing until now: the list named only the dead Phase 1
 * project, so the guard could not fire against the one database it was written
 * to protect. Add a ref here whenever a project starts holding data worth
 * keeping.
 */
const FORBIDDEN_PROJECT_REFS = [
  'udawaiykfvdcvcouiqxr', // hive-dev — holds the demo dataset
  'fhvwsmtivwtmbdscdoyz', // Phase 1 project, dead, still named in README_MIGRATIONS.md:20
];

for (const ref of FORBIDDEN_PROJECT_REFS) {
  if (TEST_URL.includes(ref)) {
    throw new Error(
      `REFUSING TO RUN.\n\n` +
        `SUPABASE_URL points at project "${ref}", which is not a test project.\n` +
        `This suite truncates every domain table and deletes auth users. ` +
        `Running it here would wipe the demo data.\n\n` +
        `Point .env.test at a separate Supabase project.`,
    );
  }
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('REFUSING TO RUN: NODE_ENV is production.');
}

export const supabaseTest: SupabaseClient = createClient(TEST_URL, TEST_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const TEST_PASSWORD = process.env.DEMO_PASSWORD ?? 'test-only-password';

/**
 * Every school this process created, in creation order.
 *
 * `createTestSchool` registers here, and it is the root the scoped cleanup
 * below hangs off: every domain table except `notifications` carries a
 * `school_id`, or cascades from a row that does. Exported rather than kept in
 * `helpers.ts` because `helpers` imports this module, not the other way round.
 */
export const createdSchoolIds: string[] = [];

/**
 * Delete only the rows this process created.
 *
 * This replaces a `truncateAll()` that ran in a global `beforeAll` and emptied
 * every domain table. That was safe only while exactly one suite run existed
 * at a time, and `hive-test` is shared — CI runs the same suite on every push
 * (.github/workflows/ci.yml, `Test backend`) against the same project a
 * developer runs it against locally. Two runs overlapping meant one run's
 * `beforeAll` wiped the other run's fixtures *while its tests were mid-flight*,
 * which is what made this suite flaky:
 *
 *   - `photos.test.ts` failed with `insert or update on table "photos"
 *     violates foreign key constraint "photos_school_id_fkey"` — the school it
 *     had created eight seconds earlier was gone;
 *   - `authorization.test.ts` failed the same way on `students_school_id_fkey`;
 *   - `auth.test.ts > T-2b` expected 401 and got 404;
 *   - and `POST /api/v1/orders` blocked for 181s and 379s against a 30s
 *     timeout, because a concurrent DELETE of `schools`/`photos` holds the
 *     locks every insert's foreign-key check needs.
 *
 * The proof it was a second process and not this one: a run's own truncates
 * were traced and all sat at file boundaries, files run strictly sequentially
 * (`fileParallelism: false` below), and yet `errors.test.ts` — which creates no
 * school at all — observed the `schools` table go from 0 to 2 rows during its
 * own run.
 *
 * Scoping the cleanup means two runs no longer collide: each deletes its own
 * rows and leaves everyone else's alone. Leftovers from a foreign run are
 * harmless because no assertion in this suite counts rows globally — they all
 * scope by id, by parent, or by school.
 *
 * Order matters, and it is the order the old `truncateAll` used, because 00018
 * made `order_items.photo_id`, `photos.uploaded_by` and
 * `photo_student_tags.tagged_by` ON DELETE RESTRICT: line items must go before
 * photos, and photos before the profiles that uploaded them.
 */
export async function cleanupCreatedRows(): Promise<void> {
  if (createdSchoolIds.length === 0) return;
  const schoolIds = [...createdSchoolIds];

  // orders first — order_items cascade from them, and order_items.photo_id is
  // RESTRICT, so a line item still standing blocks the photo delete below.
  await supabaseTest.from('orders').delete().in('school_id', schoolIds);
  // photo_student_tags cascade from photos (photo_id), which clears the
  // RESTRICT that tagged_by would otherwise hold over the teacher's profile.
  await supabaseTest.from('photos').delete().in('school_id', schoolIds);
  await supabaseTest.from('students').delete().in('school_id', schoolIds);
  await supabaseTest.from('classes').delete().in('school_id', schoolIds);
  await supabaseTest.from('schools').delete().in('id', schoolIds);

  createdSchoolIds.length = 0;
}

/**
 * Safety net. Each suite already ends with `afterAll(cleanupUsers)`, which
 * calls the same cleanup, but a file that creates a school outside a `describe`
 * — or one whose `beforeAll` throws part-way through, as happened when the
 * foreign-key failures above hit — would otherwise leave its rows behind
 * forever, now that nothing truncates. Cheap to run twice: the id list is
 * emptied on the first pass.
 */
afterAll(async () => {
  await cleanupCreatedRows();
});
