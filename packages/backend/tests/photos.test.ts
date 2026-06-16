import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import app from '../src/app';
import { supabaseTest } from './setup';
import {
  createTestUser,
  createTestSchool,
  createTestClass,
  createTestStudent,
  createTestPhoto,
  linkParent,
  tagStudent,
  cleanupUsers,
  bearer,
  type TestUser,
} from './helpers';

const FIXTURES = join(__dirname, 'fixtures');
const validJpeg = () => readFileSync(join(FIXTURES, 'valid.jpg'));

describe('photo upload, tagging and ownership', () => {
  let schoolA: string, schoolB: string, classA: string, classB: string;
  let teacherA: TestUser, teacherB: TestUser, parentA: TestUser;
  let childA: string;

  beforeAll(async () => {
    schoolA = await createTestSchool('School A');
    schoolB = await createTestSchool('School B');
    classA = await createTestClass(schoolA);
    classB = await createTestClass(schoolB);

    teacherA = await createTestUser('teacher', schoolA);
    teacherB = await createTestUser('teacher', schoolB);
    parentA = await createTestUser('parent', schoolA);

    childA = await createTestStudent(schoolA, classA, 'Child A');
    await linkParent(parentA.id, childA);
  }, 60_000);

  afterAll(cleanupUsers);

  // T-9
  it('rejects an unauthenticated upload request', async () => {
    const res = await request(app)
      .post('/api/v1/photos/upload-url')
      .send({ classId: classA, filename: 'x.jpg', contentType: 'image/jpeg', fileSize: 1000 });
    expect(res.status).toBe(401);
  });

  it('rejects a parent creating a photo record', async () => {
    const res = await request(app)
      .post('/api/v1/photos/upload-url')
      .set(bearer(parentA.token))
      .send({ classId: classA, filename: 'x.jpg', contentType: 'image/jpeg', fileSize: 1000 });
    expect(res.status).toBe(403);
  });

  // T-22
  it('rejects a teacher creating a photo in another school\'s class', async () => {
    const res = await request(app)
      .post('/api/v1/photos/upload-url')
      .set(bearer(teacherB.token))
      .send({ classId: classA, filename: 'x.jpg', contentType: 'image/jpeg', fileSize: 1000 });
    expect(res.status).toBe(403);
  });

  // T-20 — magic bytes, not the client-declared MIME
  it('rejects a file that is not really an image', async () => {
    const slot = await request(app)
      .post('/api/v1/photos/upload-url')
      .set(bearer(teacherA.token))
      .send({ classId: classA, filename: 'fake.jpg', contentType: 'image/jpeg', fileSize: 100 });
    expect(slot.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/photos/${slot.body.data.photoId}/file`)
      .set(bearer(teacherA.token))
      .attach('file', Buffer.from('this is plain text, not a jpeg'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
  }, 30_000);

  // T-21
  it('rejects a file over the 25 MB limit', async () => {
    const slot = await request(app)
      .post('/api/v1/photos/upload-url')
      .set(bearer(teacherA.token))
      .send({ classId: classA, filename: 'big.jpg', contentType: 'image/jpeg', fileSize: 1000 });

    const oversized = Buffer.alloc(26 * 1024 * 1024, 0);
    const res = await request(app)
      .post(`/api/v1/photos/${slot.body.data.photoId}/file`)
      .set(bearer(teacherA.token))
      .attach('file', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  // T-8 — ownership on the file endpoint
  it('rejects a teacher uploading onto another teacher\'s photo', async () => {
    const photoId = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
    });

    const res = await request(app)
      .post(`/api/v1/photos/${photoId}/file`)
      .set(bearer(teacherB.token))
      .attach('file', validJpeg(), { filename: 'x.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  }, 30_000);

  // T-24
  it('rejects tagging a student from another school', async () => {
    const photoId = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
    });
    const foreignChild = await createTestStudent(schoolB, classB, 'Foreign Child');

    const res = await request(app)
      .post(`/api/v1/photos/${photoId}/tag`)
      .set(bearer(teacherA.token))
      .send({ studentIds: [foreignChild] });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed tagging payload', async () => {
    const photoId = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
    });

    // Empty array, non-UUID, and missing field must all be rejected — before
    // Plan 05 this endpoint had no validation at all.
    for (const body of [{ studentIds: [] }, { studentIds: ['not-a-uuid'] }, {}]) {
      const res = await request(app)
        .post(`/api/v1/photos/${photoId}/tag`)
        .set(bearer(teacherA.token))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  // T-25
  it('is idempotent when the same student is tagged twice', async () => {
    const photoId = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
    });

    const first = await request(app)
      .post(`/api/v1/photos/${photoId}/tag`)
      .set(bearer(teacherA.token))
      .send({ studentIds: [childA] });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/photos/${photoId}/tag`)
      .set(bearer(teacherA.token))
      .send({ studentIds: [childA] });
    expect(second.status).toBe(200);

    const { count } = await supabaseTest
      .from('photo_student_tags')
      .select('id', { count: 'exact', head: true })
      .eq('photo_id', photoId)
      .eq('student_id', childA);

    expect(count).toBe(1);
  });

  /**
   * T-23 — the most valuable test in the suite.
   *
   * notify_parents_on_photo fires on the transition to 'ready' and loops over
   * photo_student_tags. The original pipeline set 'ready' before tagging, so
   * the loop always ran against zero rows and no parent was ever notified.
   *
   * Teachers still received their own upload-complete notification, which is
   * exactly why the defect survived — the feature looked partly working.
   *
   * This is the only automated way to catch a regression, because the symptom
   * is a notification that silently never arrives.
   */
  it('notifies tagged children\'s parents when a photo is confirmed', async () => {
    const photoId = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
      status: 'processing',
    });

    // Tag FIRST — the ordering under test.
    await tagStudent(photoId, childA, teacherA.id);

    const res = await request(app)
      .post(`/api/v1/photos/${photoId}/confirm`)
      .set(bearer(teacherA.token));
    expect(res.status).toBe(200);

    const { data: notifications } = await supabaseTest
      .from('notifications')
      .select('type, data')
      .eq('user_id', parentA.id)
      .eq('type', 'new_photos');

    expect(notifications?.length ?? 0).toBeGreaterThan(0);
    expect(notifications?.some((n) => (n.data as { photo_id?: string })?.photo_id === photoId)).toBe(
      true,
    );
  }, 30_000);

  // T-7 — cross-school listing
  it('rejects a teacher listing another school\'s class photos', async () => {
    const res = await request(app)
      .get(`/api/v1/photos?classId=${classB}`)
      .set(bearer(teacherA.token));

    expect(res.status).toBe(403);
  });
});
