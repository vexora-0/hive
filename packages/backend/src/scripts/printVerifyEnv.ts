/**
 * Print the environment scripts/verify-security.sh needs, as export lines.
 *
 *   eval "$(pnpm --filter @hive/backend verify:env | grep '^export')"
 *   ./scripts/verify-security.sh
 *
 * The grep matters — pnpm writes its own banner to stdout under --filter, and
 * eval fails on it. Everything this script prints to stdout is an export line;
 * the human-readable summary goes to stderr for the same reason.
 *
 * Until now there was no way to obtain a demo token short of signing in on a
 * device and copying the bearer out of a network log, which is why a script
 * written to prove the authorization model had never been run against one.
 *
 * Everything except the account emails is DERIVED from the database rather
 * than hard-coded. The seed uses fixed UUIDs, so hard-coding them would have
 * been shorter — but then a drifted dataset produces a run that is green
 * because it tested the wrong rows. Deriving means this script fails loudly
 * instead, which is the failure mode worth having.
 *
 * Tokens are printed to stdout and never written to a file. They are real
 * credentials with the lifetime Supabase gives them; do not paste the output
 * anywhere it persists.
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY,
  DEMO_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} = process.env;

const missing = Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY,
  DEMO_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('See docs/environment-setup.md.');
  console.error(
    'SUPABASE_ANON_KEY is needed because the service-role key does not mint the',
  );
  console.error('user-scoped JWT the API expects — only a real sign-in does.');
  process.exit(1);
}

const admin: SupabaseClient = createClient(
  SUPABASE_URL as string,
  SUPABASE_SERVICE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** The seeded accounts. These emails are the only fixed values here. */
const TEACHER_X_EMAIL = 'teacher.sarita@bloom.demo';
const PARENT_A_EMAIL = 'parent.rajesh@bloom.demo';

function die(message: string): never {
  console.error(`\nCannot build a verification environment: ${message}`);
  console.error('Run `pnpm --filter @hive/backend seed:demo` first.');
  process.exit(1);
}

/** Sign in for real. A service-role client cannot stand in for a user here. */
async function tokenFor(email: string, password: string): Promise<string> {
  const anon = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    die(`sign-in failed for ${email}: ${error?.message ?? 'no session returned'}`);
  }
  return data.session.access_token;
}

async function profileByEmail(
  email: string,
): Promise<{ id: string; school_id: string | null }> {
  // profiles has no email column — it lives on auth.users.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) die(`listUsers: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user) die(`no account for ${email}`);

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, school_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) die(`no profile for ${email}: ${profileError?.message}`);

  return profile as { id: string; school_id: string | null };
}

async function main(): Promise<void> {
  const teacherX = await profileByEmail(TEACHER_X_EMAIL);
  const parentA = await profileByEmail(PARENT_A_EMAIL);

  if (!teacherX.school_id) die(`${TEACHER_X_EMAIL} has no school`);
  const schoolX = teacherX.school_id;

  // A SECOND teacher at the SAME school. This is the whole point of the
  // script: G-17 is about uploader ownership, and a teacher from another
  // school is refused by the school check before ownership is ever consulted.
  const { data: colleagues } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'teacher')
    .eq('school_id', schoolX)
    .neq('id', teacherX.id);

  const teacherX2 = colleagues?.[0]?.id;
  if (!teacherX2) {
    die(
      `no second teacher at school ${schoolX}. The G-17 check needs two ` +
        'teachers at the same school and cannot run without one.',
    );
  }

  const { data: otherSchool } = await admin
    .from('schools')
    .select('id')
    .neq('id', schoolX)
    .limit(1)
    .single();
  if (!otherSchool) die('only one school exists — the cross-school checks cannot run');
  const schoolY = (otherSchool as { id: string }).id;

  const { data: classAtY } = await admin
    .from('classes')
    .select('id')
    .eq('school_id', schoolY)
    .limit(1)
    .single();
  if (!classAtY) die(`school ${schoolY} has no classes`);

  // Parent A's own children, straight from the mapping table the privacy model
  // rests on. verify-security.sh asserts taggedStudentIds against this.
  const { data: mappings } = await admin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', parentA.id);
  const childIds = (mappings ?? []).map((m) => (m as { student_id: string }).student_id);
  if (!childIds.length) die(`${PARENT_A_EMAIL} has no children`);

  // A photo tagging one of parent A's children — the legitimate-access case.
  const { data: ownTags } = await admin
    .from('photo_student_tags')
    .select('photo_id')
    .in('student_id', childIds);
  const ownPhotoIds = [...new Set((ownTags ?? []).map((t) => (t as { photo_id: string }).photo_id))];
  if (!ownPhotoIds.length) die(`no photo tags any child of ${PARENT_A_EMAIL}`);

  const { data: photoOfA } = await admin
    .from('photos')
    .select('id, s3_key')
    .in('id', ownPhotoIds)
    .eq('status', 'ready')
    .limit(1)
    .single();
  if (!photoOfA) die('no ready photo tagging one of parent A\'s children');

  // A photo tagging NO child of parent A. Requesting it must 404 — the G-04
  // check. Taken from the other school so it is unambiguously foreign.
  const { data: foreignPhotos } = await admin
    .from('photos')
    .select('id')
    .eq('school_id', schoolY)
    .eq('status', 'ready');
  const foreign = (foreignPhotos ?? []).find(
    (p) => !ownPhotoIds.includes((p as { id: string }).id),
  );
  if (!foreign) die(`school ${schoolY} has no photo that excludes parent A's children`);
  const photoOfB = (foreign as { id: string }).id;

  // A photo uploaded by the colleague — same school, different uploader.
  const { data: photoOfX2 } = await admin
    .from('photos')
    .select('id')
    .eq('uploaded_by', teacherX2)
    .limit(1)
    .single();
  if (!photoOfX2) {
    die(
      `the second teacher at school ${schoolX} has uploaded no photo, so the ` +
        'G-17 ownership check has nothing to probe.',
    );
  }

  const [parentAToken, teacherXToken, teacherX2Token, adminToken] = await Promise.all([
    tokenFor(PARENT_A_EMAIL, DEMO_PASSWORD as string),
    tokenFor(TEACHER_X_EMAIL, DEMO_PASSWORD as string),
    (async () => {
      const { data } = await admin.auth.admin.getUserById(teacherX2);
      if (!data.user?.email) die('the second teacher has no email');
      return tokenFor(data.user.email, DEMO_PASSWORD as string);
    })(),
    tokenFor(ADMIN_EMAIL as string, ADMIN_PASSWORD as string),
  ]);

  const out = [
    `export BASE_URL='${process.env.BACKEND_URL ?? 'http://localhost:4000'}'`,
    `export PARENT_A_TOKEN='${parentAToken}'`,
    `export PARENT_A_CHILD_IDS='${childIds.join(',')}'`,
    `export TEACHER_X_TOKEN='${teacherXToken}'`,
    `export TEACHER_X2_TOKEN='${teacherX2Token}'`,
    `export ADMIN_TOKEN='${adminToken}'`,
    `export SCHOOL_X='${schoolX}'`,
    `export SCHOOL_Y='${schoolY}'`,
    `export CLASS_AT_Y='${(classAtY as { id: string }).id}'`,
    `export PHOTO_OF_A='${(photoOfA as { id: string }).id}'`,
    `export PHOTO_OF_B='${photoOfB}'`,
    `export PHOTO_OF_Y='${photoOfB}'`,
    `export PHOTO_OF_X2='${(photoOfX2 as { id: string }).id}'`,
    `export REAL_S3_KEY='${(photoOfA as { s3_key: string }).s3_key}'`,
  ];

  console.log(out.join('\n'));

  // stderr, so `eval "$(...)"` shows this without trying to execute it.
  console.error(
    [
      '',
      'Verification environment ready:',
      `  school X          ${schoolX}  (${TEACHER_X_EMAIL})`,
      `  school Y          ${schoolY}`,
      `  teacher X2        ${teacherX2}  — same school as X, the G-17 pair`,
      `  parent A children ${childIds.length}`,
      '',
      'These are real access tokens. Do not paste them anywhere that persists.',
      '',
    ].join('\n'),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
