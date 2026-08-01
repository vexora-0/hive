/**
 * Seed a realistic demo dataset.
 *
 * Replaces supabase/seed.sql, which could never run: it inserted `profiles`
 * rows directly, but profiles.id references auth.users, and auth.users cannot
 * be populated with plain SQL — Supabase Auth owns password hashing and
 * identity records. Every insert failed on a foreign key.
 *
 *   pnpm seed            # idempotent — safe to re-run
 *   pnpm seed:demo:reset # wipe first
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD and
 * DEMO_PASSWORD. See docs/environment-setup.md.
 */

import 'dotenv/config';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { processAndUploadPhoto } from '../utils/imageProcessor';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
} = process.env;

const missing = Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('See docs/environment-setup.md');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_KEY as string, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes('--reset');
const ASSETS = join(__dirname, 'seed-assets');

// Fixed IDs so re-running does not duplicate. Auth user IDs cannot be fixed —
// Supabase assigns them — so profiles are resolved by email after creation.
const SCHOOL = {
  bloom: 'a0000000-0000-4000-8000-000000000001',
  stars: 'a0000000-0000-4000-8000-000000000002',
};
const CLASS = {
  bloomA: 'd0000000-0000-4000-8000-000000000001',
  bloomB: 'd0000000-0000-4000-8000-000000000002',
  starsA: 'd0000000-0000-4000-8000-000000000003',
  starsB: 'd0000000-0000-4000-8000-000000000004',
};

interface DemoUser {
  key: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'parent';
  schoolId: string | null;
}

const USERS: DemoUser[] = [
  { key: 'admin', email: ADMIN_EMAIL as string, name: 'Hive Admin', role: 'admin', schoolId: null },
  { key: 'sarita', email: 'teacher.sarita@bloom.demo', name: 'Sarita Devi', role: 'teacher', schoolId: SCHOOL.bloom },
  { key: 'dinesh', email: 'teacher.dinesh@bloom.demo', name: 'Dinesh Kumar', role: 'teacher', schoolId: SCHOOL.bloom },
  { key: 'kavitha', email: 'teacher.kavitha@stars.demo', name: 'Kavitha Reddy', role: 'teacher', schoolId: SCHOOL.stars },
  { key: 'rajesh', email: 'parent.rajesh@bloom.demo', name: 'Rajesh Kumar', role: 'parent', schoolId: SCHOOL.bloom },
  { key: 'lakshmi', email: 'parent.lakshmi@bloom.demo', name: 'Lakshmi Menon', role: 'parent', schoolId: SCHOOL.bloom },
  { key: 'anita', email: 'parent.anita@bloom.demo', name: 'Anita Sharma', role: 'parent', schoolId: SCHOOL.bloom },
  { key: 'vikram', email: 'parent.vikram@stars.demo', name: 'Vikram Nair', role: 'parent', schoolId: SCHOOL.stars },
];

const STUDENTS = [
  { id: 'e0000000-0000-4000-8000-000000000001', name: 'Aarav Kumar', classId: CLASS.bloomA, schoolId: SCHOOL.bloom, parents: ['rajesh'] },
  { id: 'e0000000-0000-4000-8000-000000000002', name: 'Diya Kumar', classId: CLASS.bloomA, schoolId: SCHOOL.bloom, parents: ['rajesh'] },
  { id: 'e0000000-0000-4000-8000-000000000003', name: 'Ishaan Menon', classId: CLASS.bloomA, schoolId: SCHOOL.bloom, parents: ['lakshmi'] },
  { id: 'e0000000-0000-4000-8000-000000000004', name: 'Kiara Sharma', classId: CLASS.bloomB, schoolId: SCHOOL.bloom, parents: ['anita', 'lakshmi'] },
  { id: 'e0000000-0000-4000-8000-000000000005', name: 'Reyansh Gupta', classId: CLASS.bloomB, schoolId: SCHOOL.bloom, parents: ['anita'] },
  { id: 'e0000000-0000-4000-8000-000000000006', name: 'Saanvi Patel', classId: CLASS.bloomB, schoolId: SCHOOL.bloom, parents: [] },
  { id: 'e0000000-0000-4000-8000-000000000007', name: 'Arjun Nair', classId: CLASS.starsA, schoolId: SCHOOL.stars, parents: ['vikram'] },
  { id: 'e0000000-0000-4000-8000-000000000008', name: 'Myra Nair', classId: CLASS.starsA, schoolId: SCHOOL.stars, parents: ['vikram'] },
  { id: 'e0000000-0000-4000-8000-000000000009', name: 'Vivaan Rao', classId: CLASS.starsB, schoolId: SCHOOL.stars, parents: [] },
];

const log = (msg: string) => console.log(`  ${msg}`);

async function reset(): Promise<void> {
  log('Wiping existing demo data...');
  const any = '00000000-0000-0000-0000-000000000000';
  for (const table of [
    'order_items',
    'orders',
    'notifications',
    'photo_student_tags',
    'photos',
    'parent_student_mappings',
    'students',
    'classes',
    'schools',
  ]) {
    await supabase.from(table).delete().neq('id', any);
  }
  const { data } = await supabase.auth.admin.listUsers();
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith('.demo') || u.email === ADMIN_EMAIL) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
}

/** Create the auth user if absent, then patch role and school. */
async function upsertUser(u: DemoUser): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers();
  let id = list?.users.find((x) => x.email === u.email)?.id;

  if (!id) {
    const password = u.role === 'admin' ? (ADMIN_PASSWORD as string) : (DEMO_PASSWORD as string);
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { role: u.role, full_name: u.name },
    });
    if (error || !data.user) throw new Error(`createUser ${u.email}: ${error?.message}`);
    id = data.user.id;
  }

  // The handle_new_user trigger cannot know the school, and defaults admins to
  // parent, so both are set here.
  await supabase
    .from('profiles')
    .update({ role: u.role, school_id: u.schoolId, full_name: u.name })
    .eq('id', id);

  return id;
}

async function seedPhotos(ids: Record<string, string>): Promise<void> {
  if (!existsSync(ASSETS)) {
    log(`No seed-assets directory — skipping photos. Add JPEGs to ${ASSETS}`);
    return;
  }
  const files = readdirSync(ASSETS).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (!files.length) {
    log('seed-assets is empty — skipping photos.');
    return;
  }

  // School is carried explicitly. Deriving it from the class UUID prefix was a
  // bug: every class ID starts with the same eight characters, so every photo
  // was attributed to the wrong school and became invisible to the teacher who
  // uploaded it.
  const plan = [
    { class: CLASS.bloomA, school: SCHOOL.bloom, teacher: 'sarita', students: [STUDENTS[0].id] },
    { class: CLASS.bloomA, school: SCHOOL.bloom, teacher: 'sarita', students: [STUDENTS[0].id, STUDENTS[1].id] }, // siblings — exercises feed dedup
    { class: CLASS.bloomA, school: SCHOOL.bloom, teacher: 'sarita', students: [STUDENTS[2].id] },
    { class: CLASS.bloomB, school: SCHOOL.bloom, teacher: 'dinesh', students: [STUDENTS[3].id, STUDENTS[4].id] },
    { class: CLASS.bloomB, school: SCHOOL.bloom, teacher: 'dinesh', students: [STUDENTS[4].id] },
    { class: CLASS.starsA, school: SCHOOL.stars, teacher: 'kavitha', students: [STUDENTS[6].id, STUDENTS[7].id] },
  ];

  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    const file = files[i % files.length];
    const buffer = readFileSync(join(ASSETS, file));
    // Deterministic, so re-running updates the same six rows instead of adding
    // six more. crypto.randomUUID() here made the script's "safe to re-run"
    // promise false: every run duplicated the entire photo set.
    const photoId = `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const schoolId = entry.school;
    const key = `photos/${schoolId}/${entry.class}/${photoId}.jpg`;

    const { error: insertError } = await supabase.from('photos').upsert({
      id: photoId,
      school_id: schoolId,
      class_id: entry.class,
      uploaded_by: ids[entry.teacher],
      s3_key: key,
      mime_type: 'image/jpeg',
      original_filename: file,
      status: 'processing',
    });
    if (insertError) throw new Error(`photo insert: ${insertError.message}`);

    // Same helper the upload endpoint uses, so demo photos are processed
    // identically to real ones — thumbnails, blurhash and dimensions included.
    const processed = await processAndUploadPhoto(buffer, key, 'image/jpeg');

    const { error: updateError } = await supabase
      .from('photos')
      .update({
        s3_key: processed.storagePath,
        thumbnail_s3_key: processed.thumbnailPath,
        width: processed.width,
        height: processed.height,
        blurhash: processed.blurhash,
      })
      .eq('id', photoId);
    if (updateError) throw new Error(`photo metadata update: ${updateError.message}`);

    for (const studentId of entry.students) {
      await supabase.from('photo_student_tags').upsert(
        {
          photo_id: photoId,
          student_id: studentId,
          tagged_by: ids[entry.teacher],
        },
        { onConflict: 'photo_id,student_id' },
      );
    }

    // ready LAST. notify_parents_on_photo fires on this transition and loops
    // over photo_student_tags — flipping it before tagging produces a demo with
    // no parent notifications, which is exactly what you want to show.
    await supabase.from('photos').update({ status: 'ready' }).eq('id', photoId);

    log(`photo ${i + 1}/${plan.length} (${entry.students.length} tagged)`);
  }
}

async function main(): Promise<void> {
  console.log('\nSeeding Hive demo data\n');
  if (RESET) await reset();

  log('Schools and classes...');
  await supabase.from('schools').upsert([
    { id: SCHOOL.bloom, name: 'Bloom Preschool', address: '123 MG Road, Koramangala, Bangalore 560034', phone: '+91 98765 43210' },
    { id: SCHOOL.stars, name: 'Little Stars Academy', address: '456 Linking Road, Bandra West, Mumbai 400050', phone: '+91 98765 43211' },
  ]);
  await supabase.from('classes').upsert([
    { id: CLASS.bloomA, school_id: SCHOOL.bloom, name: 'Sunflower', grade: 'Pre-K', academic_year: '2026-2027' },
    { id: CLASS.bloomB, school_id: SCHOOL.bloom, name: 'Marigold', grade: 'Pre-K', academic_year: '2026-2027' },
    { id: CLASS.starsA, school_id: SCHOOL.stars, name: 'Rainbow', grade: 'Nursery', academic_year: '2026-2027' },
    { id: CLASS.starsB, school_id: SCHOOL.stars, name: 'Comet', grade: 'Nursery', academic_year: '2026-2027' },
  ]);

  log('Users...');
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.key] = await upsertUser(u);

  log('Class teachers...');
  await supabase.from('classes').update({ teacher_id: ids.sarita }).eq('id', CLASS.bloomA);
  await supabase.from('classes').update({ teacher_id: ids.dinesh }).eq('id', CLASS.bloomB);
  await supabase.from('classes').update({ teacher_id: ids.kavitha }).eq('id', CLASS.starsA);

  log('Students and parent links...');
  await supabase.from('students').upsert(
    STUDENTS.map((s) => ({ id: s.id, school_id: s.schoolId, class_id: s.classId, full_name: s.name })),
  );
  for (const s of STUDENTS) {
    for (const p of s.parents) {
      await supabase
        .from('parent_student_mappings')
        .upsert({ parent_id: ids[p], student_id: s.id, relationship: 'parent' }, { onConflict: 'parent_id,student_id' });
    }
  }

  log('Photos...');
  await seedPhotos(ids);


  const { count: notifications } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'new_photos');

  console.log('\nDone.\n');
  console.log(`  Admin    ${ADMIN_EMAIL}`);
  console.log('  Teacher  teacher.sarita@bloom.demo');
  console.log('  Parent   parent.rajesh@bloom.demo   (two children — exercises the switcher)');
  console.log('\n  Passwords are in your .env. See docs/DEMO_USERS.md.');
  console.log(`\n  new_photos notifications produced: ${notifications ?? 0}`);
  if (!notifications) {
    console.log('  WARNING: zero notifications means tags were applied after status went ready.');
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
