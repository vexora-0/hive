import { randomUUID } from 'crypto';
import { supabaseTest } from './setup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TestRole = 'teacher' | 'parent' | 'admin';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: TestRole;
  schoolId: string | null;
  /** Bearer token for `Authorization: Bearer <token>`. */
  token: string;
}

// ---------------------------------------------------------------------------
// Tracking, for cleanup()
// ---------------------------------------------------------------------------

const createdUserIds: string[] = [];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'test-Passw0rd!';

/**
 * Create a confirmed auth user, set its profile role and school, and sign it in
 * to obtain a real access token.
 *
 * The token has to come from a genuine `signInWithPassword` — the whole point
 * of these tests is that `authenticate` verifies it against Supabase, so a
 * hand-built JWT would test nothing.
 *
 * `handle_new_user` (migration 00003) inserts the `profiles` row on signup, so
 * this updates that row rather than inserting one.
 */
export async function createTestUser(
  role: TestRole,
  schoolId: string | null = null,
): Promise<TestUser> {
  const email = `test-${role}-${randomUUID()}@hive.test`;

  const { data: created, error: createError } =
    await supabaseTest.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  if (createError || !created.user) {
    throw new Error(`createTestUser: ${createError?.message}`);
  }

  const userId = created.user.id;
  createdUserIds.push(userId);

  const { error: profileError } = await supabaseTest
    .from('profiles')
    .update({ role, school_id: schoolId, full_name: `Test ${role}` })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`createTestUser profile: ${profileError.message}`);
  }

  const { data: session, error: signInError } =
    await supabaseTest.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });

  if (signInError || !session.session) {
    throw new Error(`createTestUser signIn: ${signInError?.message}`);
  }

  return {
    id: userId,
    email,
    password: TEST_PASSWORD,
    role,
    schoolId,
    token: session.session.access_token,
  };
}

// ---------------------------------------------------------------------------
// Domain fixtures
// ---------------------------------------------------------------------------

export async function createTestSchool(name = 'Test School'): Promise<string> {
  const id = randomUUID();

  const { error } = await supabaseTest
    .from('schools')
    .insert({ id, name, address: '1 Test Street' });

  if (error) throw new Error(`createTestSchool: ${error.message}`);
  return id;
}

export async function createTestClass(
  schoolId: string,
  teacherId: string | null = null,
  name = 'Test Class',
): Promise<string> {
  const id = randomUUID();

  const { error } = await supabaseTest
    .from('classes')
    .insert({ id, school_id: schoolId, name, teacher_id: teacherId });

  if (error) throw new Error(`createTestClass: ${error.message}`);
  return id;
}

export async function createTestStudent(
  schoolId: string,
  classId: string | null = null,
  fullName = 'Test Student',
): Promise<string> {
  const id = randomUUID();

  const { error } = await supabaseTest.from('students').insert({
    id,
    school_id: schoolId,
    class_id: classId,
    full_name: fullName,
    date_of_birth: '2020-01-01',
  });

  if (error) throw new Error(`createTestStudent: ${error.message}`);
  return id;
}

export async function linkParent(
  parentId: string,
  studentId: string,
  relationship = 'parent',
): Promise<void> {
  const { error } = await supabaseTest
    .from('parent_student_mappings')
    .insert({ parent_id: parentId, student_id: studentId, relationship });

  if (error) throw new Error(`linkParent: ${error.message}`);
}

export async function createTestPhoto(
  schoolId: string,
  classId: string,
  uploadedBy: string,
  status: 'processing' | 'ready' | 'failed' = 'ready',
): Promise<string> {
  const id = randomUUID();

  const { error } = await supabaseTest.from('photos').insert({
    id,
    school_id: schoolId,
    class_id: classId,
    uploaded_by: uploadedBy,
    status,
    s3_key: `photos/${schoolId}/${classId}/${id}.jpg`,
    original_filename: 'test.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 1024,
  });

  if (error) throw new Error(`createTestPhoto: ${error.message}`);
  return id;
}

export async function tagStudent(
  photoId: string,
  studentId: string,
  taggedBy: string,
): Promise<void> {
  const { error } = await supabaseTest
    .from('photo_student_tags')
    .insert({ photo_id: photoId, student_id: studentId, tagged_by: taggedBy });

  if (error) throw new Error(`tagStudent: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete every auth user this run created.
 *
 * Domain rows are handled by `truncateAll()` in setup.ts; auth users live in
 * the `auth` schema, which PostgREST does not expose, so they need the Admin
 * API. Deleting the auth user cascades to its `profiles` row.
 */
export async function cleanup(): Promise<void> {
  const ids = createdUserIds.splice(0);

  await Promise.allSettled(
    ids.map((id) => supabaseTest.auth.admin.deleteUser(id)),
  );
}

/**
 * A syntactically valid UUID that will not exist in the database. Use for
 * "unknown ID" cases so the failure is a genuine 404 and not a 400 from UUID
 * validation.
 */
export function unknownUuid(): string {
  return randomUUID();
}
