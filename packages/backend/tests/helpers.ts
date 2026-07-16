import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseTest, TEST_PASSWORD } from './setup';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  schoolId: string | null;
}

const createdUserIds: string[] = [];

/**
 * Create an authenticated user and return a usable access token.
 *
 * The handle_new_user trigger creates the profile from signup metadata, so the
 * role and school are patched afterwards — the trigger cannot know the school.
 */
export async function createTestUser(
  role: 'parent' | 'teacher' | 'admin',
  schoolId: string | null = null,
): Promise<TestUser> {
  const email = `${role}.${randomUUID().slice(0, 8)}@hive.test`;

  const { data, error } = await supabaseTest.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: `Test ${role}` },
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`);

  createdUserIds.push(data.user.id);

  await supabaseTest.from('profiles').update({ role, school_id: schoolId }).eq('id', data.user.id);

  // Sign in through the anon client — the service-role key does not mint the
  // user-scoped JWT the API expects.
  const anon = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_ANON_KEY as string,
  );
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError || !session.session) {
    throw new Error(`Sign-in failed for ${email}: ${signInError?.message}`);
  }

  return { id: data.user.id, email, token: session.session.access_token, schoolId };
}

export async function createTestSchool(name = 'Test Preschool'): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseTest.from('schools').insert({ id, name });
  if (error) throw new Error(`createTestSchool: ${error.message}`);
  return id;
}

export async function createTestClass(schoolId: string, name = 'Test Class'): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseTest.from('classes').insert({ id, school_id: schoolId, name });
  if (error) throw new Error(`createTestClass: ${error.message}`);
  return id;
}

export async function createTestStudent(
  schoolId: string,
  classId: string,
  fullName = 'Test Child',
): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseTest
    .from('students')
    .insert({ id, school_id: schoolId, class_id: classId, full_name: fullName });
  if (error) throw new Error(`createTestStudent: ${error.message}`);
  return id;
}

export async function linkParent(parentId: string, studentId: string): Promise<void> {
  const { error } = await supabaseTest
    .from('parent_student_mappings')
    .insert({ parent_id: parentId, student_id: studentId });
  if (error) throw new Error(`linkParent: ${error.message}`);
}

/**
 * Insert a photo row directly.
 *
 * Deliberately bypasses the upload endpoint — most tests care about visibility
 * and authorization, not image processing, and going through the real pipeline
 * would need Storage on every test.
 *
 * `status` defaults to 'processing' so callers must opt in to 'ready', which
 * keeps the tag-before-ready ordering explicit in each test.
 */
export async function createTestPhoto(opts: {
  schoolId: string;
  classId: string;
  uploadedBy: string;
  status?: 'processing' | 'ready' | 'failed';
}): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseTest.from('photos').insert({
    id,
    school_id: opts.schoolId,
    class_id: opts.classId,
    uploaded_by: opts.uploadedBy,
    s3_key: `photos/${opts.schoolId}/${opts.classId}/${id}.jpg`,
    thumbnail_s3_key: `photos/${opts.schoolId}/${opts.classId}/${id}_thumb.jpg`,
    mime_type: 'image/jpeg',
    status: opts.status ?? 'processing',
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

export async function setPhotoReady(photoId: string): Promise<void> {
  const { error } = await supabaseTest
    .from('photos')
    .update({ status: 'ready' })
    .eq('id', photoId);
  if (error) throw new Error(`setPhotoReady: ${error.message}`);
}

/** Remove every auth user this run created. Domain rows cascade. */
export async function cleanupUsers(): Promise<void> {
  for (const id of createdUserIds) {
    await supabaseTest.auth.admin.deleteUser(id).catch(() => undefined);
  }
  createdUserIds.length = 0;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
