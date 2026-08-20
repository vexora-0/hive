import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  supabaseTest,
  TEST_PASSWORD,
  createdSchoolIds,
  cleanupCreatedRows,
} from './setup';

const PHOTOS_BUCKET = 'photos';

/** A real 1.7 KB JPEG. Small enough to upload once per test photo. */
const FIXTURE_JPEG = readFileSync(join(__dirname, 'fixtures', 'valid.jpg'));

export interface TestUser {
  id: string;
  email: string;
  /** The display name the profile trigger wrote, as the API will echo it. */
  fullName: string;
  token: string;
  schoolId: string | null;
}

const createdUserIds: string[] = [];
const uploadedObjectPaths: string[] = [];

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
  const fullName = `Test ${role}`;

  const { data, error } = await supabaseTest.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
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

  return {
    id: data.user.id,
    email,
    fullName,
    token: session.session.access_token,
    schoolId,
  };
}

export async function createTestSchool(name = 'Test Preschool'): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseTest.from('schools').insert({ id, name });
  if (error) throw new Error(`createTestSchool: ${error.message}`);
  // Registered before anything hangs off it: this id is the handle the scoped
  // cleanup uses to find every class, student, photo and order underneath.
  // Nothing truncates any more, so a school that is never registered is a row
  // that never goes away.
  createdSchoolIds.push(id);
  return id;
}

/**
 * Hand the cleanup a school this suite created through the API rather than
 * through `createTestSchool` — `POST /api/v1/admin/schools` is exercised by
 * admin.test.ts, and its schools used to be swept up by the global truncate.
 * Without this they would now outlive the run.
 */
export function registerCreatedSchool(id: string): void {
  if (id) createdSchoolIds.push(id);
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
 * Insert a photo row directly, and put a real object at its `s3_key`.
 *
 * Deliberately bypasses the upload endpoint — most tests care about visibility
 * and authorization, not image processing. But the row alone is not a faithful
 * stand-in: `confirmUpload` calls `fileExistsInStorage` and returns 404
 * FILE_NOT_FOUND when the object is missing, so a row-only fixture made T-23
 * fail for a reason that has nothing to do with what it tests. A photo row
 * whose object does not exist is a state the product never produces, so the
 * helper does not produce it either.
 *
 * `status` defaults to 'processing' so callers must opt in to 'ready', which
 * keeps the tag-before-ready ordering explicit in each test.
 */
export async function createTestPhoto(opts: {
  schoolId: string;
  classId: string;
  uploadedBy: string;
  status?: 'processing' | 'ready' | 'failed';
  /**
   * Override `created_at`.
   *
   * The diary buckets photographs into months and days, so its tests need rows
   * at chosen instants rather than all at `now()`. Everything else leaves this
   * alone and gets the default.
   */
  createdAt?: string;
  /** The teacher's note on the photograph. */
  caption?: string;
}): Promise<string> {
  const id = randomUUID();
  const s3Key = `photos/${opts.schoolId}/${opts.classId}/${id}.jpg`;
  const thumbKey = `photos/${opts.schoolId}/${opts.classId}/${id}_thumb.jpg`;

  for (const path of [s3Key, thumbKey]) {
    const { error: uploadError } = await supabaseTest.storage
      .from(PHOTOS_BUCKET)
      .upload(path, FIXTURE_JPEG, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw new Error(`createTestPhoto storage: ${uploadError.message}`);
    uploadedObjectPaths.push(path);
  }

  const { error } = await supabaseTest.from('photos').insert({
    id,
    school_id: opts.schoolId,
    class_id: opts.classId,
    uploaded_by: opts.uploadedBy,
    s3_key: s3Key,
    thumbnail_s3_key: thumbKey,
    mime_type: 'image/jpeg',
    status: opts.status ?? 'processing',
    ...(opts.createdAt ? { created_at: opts.createdAt } : {}),
    ...(opts.caption ? { caption: opts.caption } : {}),
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

/**
 * Remove every artefact this run created — domain rows, auth users and storage
 * objects.
 *
 * The domain rows used to be somebody else's problem: a global `truncateAll()`
 * ran at the start of every file and emptied the database, so this only had to
 * deal with auth users and storage. That truncate is gone — it was deleting a
 * *concurrently running* suite's fixtures out from under it (see
 * `cleanupCreatedRows` in setup.ts) — so the rows are cleaned up here, scoped
 * to the schools this process created.
 *
 * Rows first, users second: `photos.uploaded_by` is ON DELETE RESTRICT since
 * 00018, so deleting a teacher before their photos fails silently in the
 * `.catch()` below and leaks the profile.
 */
export async function cleanupUsers(): Promise<void> {
  await cleanupCreatedRows();

  for (const id of createdUserIds) {
    await supabaseTest.auth.admin.deleteUser(id).catch(() => undefined);
  }
  createdUserIds.length = 0;

  if (uploadedObjectPaths.length > 0) {
    await supabaseTest.storage
      .from(PHOTOS_BUCKET)
      .remove(uploadedObjectPaths)
      .catch(() => undefined);
    uploadedObjectPaths.length = 0;
  }
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
