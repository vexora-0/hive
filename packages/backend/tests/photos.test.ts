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

/**
 * Archiving and untagging — the corrections a teacher had no way to make.
 *
 * Both are guarded by the same `assertPhotoAccess` as upload and tagging, so
 * the ownership cases here are the G-17 class of bug: a same-school colleague
 * must not be able to act on somebody else's photo.
 */
describe('archiving a photo and untagging a student', () => {
  let school: string, otherSchool: string, classId: string;
  let teacher: TestUser, colleague: TestUser, otherTeacher: TestUser;
  let parent: TestUser, secondParent: TestUser;
  let child: string, secondChild: string;

  beforeAll(async () => {
    school = await createTestSchool('Archive School');
    otherSchool = await createTestSchool('Other School');
    classId = await createTestClass(school);

    teacher = await createTestUser('teacher', school);
    colleague = await createTestUser('teacher', school);
    otherTeacher = await createTestUser('teacher', otherSchool);
    parent = await createTestUser('parent', school);
    secondParent = await createTestUser('parent', school);

    child = await createTestStudent(school, classId, 'Archive Child');
    secondChild = await createTestStudent(school, classId, 'Second Child');
    await linkParent(parent.id, child);
    await linkParent(secondParent.id, secondChild);
  }, 60_000);

  afterAll(cleanupUsers);

  async function readyTaggedPhoto(studentIds: string[]): Promise<string> {
    const photoId = await createTestPhoto({
      schoolId: school,
      classId,
      uploadedBy: teacher.id,
      status: 'ready',
    });
    for (const studentId of studentIds) {
      await tagStudent(photoId, studentId, teacher.id);
    }
    return photoId;
  }

  it('lets the uploader archive their own photo', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}`)
      .set(bearer(teacher.token));

    expect(res.status).toBe(204);

    const { data: photo } = await supabaseTest
      .from('photos')
      .select('status')
      .eq('id', photoId)
      .single();
    expect(photo?.status).toBe('archived');
  }, 30_000);

  /**
   * The whole point of archiving: the photo has to leave the parent's feed.
   * Both feed queries filter `status = 'ready'`, so this is what makes the
   * soft delete a real removal rather than a flag nobody reads.
   */
  it('removes an archived photo from the parent feed', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const before = await request(app)
      .get(`/api/v1/feed?studentId=${child}`)
      .set(bearer(parent.token));
    expect(before.status).toBe(200);
    expect(before.body.data.some((p: { id: string }) => p.id === photoId)).toBe(true);

    await request(app).delete(`/api/v1/photos/${photoId}`).set(bearer(teacher.token));

    const after = await request(app)
      .get(`/api/v1/feed?studentId=${child}`)
      .set(bearer(parent.token));
    expect(after.status).toBe(200);
    expect(after.body.data.some((p: { id: string }) => p.id === photoId)).toBe(false);
  }, 30_000);

  it('removes an archived photo from the teacher grid', async () => {
    const photoId = await readyTaggedPhoto([child]);

    await request(app).delete(`/api/v1/photos/${photoId}`).set(bearer(teacher.token));

    const res = await request(app)
      .get(`/api/v1/photos?classId=${classId}`)
      .set(bearer(teacher.token));

    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { id: string }) => p.id === photoId)).toBe(false);
  }, 30_000);

  // The G-17 case: same school, different teacher.
  it('rejects a same-school colleague archiving another teacher\'s photo', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}`)
      .set(bearer(colleague.token));

    expect(res.status).toBe(403);

    const { data: photo } = await supabaseTest
      .from('photos')
      .select('status')
      .eq('id', photoId)
      .single();
    expect(photo?.status).toBe('ready');
  }, 30_000);

  it('rejects a teacher at another school archiving the photo', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}`)
      .set(bearer(otherTeacher.token));

    expect(res.status).toBe(403);
  }, 30_000);

  it('rejects a parent archiving a photo', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}`)
      .set(bearer(parent.token));

    expect(res.status).toBe(403);
  }, 30_000);

  it('rejects archiving the same photo twice', async () => {
    const photoId = await readyTaggedPhoto([child]);

    await request(app).delete(`/api/v1/photos/${photoId}`).set(bearer(teacher.token));
    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}`)
      .set(bearer(teacher.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATE');
  }, 30_000);

  it('rejects a malformed photo id', async () => {
    const res = await request(app)
      .delete('/api/v1/photos/not-a-uuid')
      .set(bearer(teacher.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Untagging revokes exactly one family's access. The second parent's copy of
   * the same photo must survive — this is the test that would catch a delete
   * missing its `student_id` filter.
   */
  it('untags one student without affecting the other', async () => {
    const photoId = await readyTaggedPhoto([child, secondChild]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}/tag/${child}`)
      .set(bearer(teacher.token));
    expect(res.status).toBe(204);

    const gone = await request(app)
      .get(`/api/v1/feed?studentId=${child}`)
      .set(bearer(parent.token));
    expect(gone.body.data.some((p: { id: string }) => p.id === photoId)).toBe(false);

    const kept = await request(app)
      .get(`/api/v1/feed?studentId=${secondChild}`)
      .set(bearer(secondParent.token));
    expect(kept.body.data.some((p: { id: string }) => p.id === photoId)).toBe(true);
  }, 30_000);

  it('returns 404 when the tag does not exist', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}/tag/${secondChild}`)
      .set(bearer(teacher.token));

    expect(res.status).toBe(404);
  }, 30_000);

  it('rejects a colleague untagging a student from another teacher\'s photo', async () => {
    const photoId = await readyTaggedPhoto([child]);

    const res = await request(app)
      .delete(`/api/v1/photos/${photoId}/tag/${child}`)
      .set(bearer(colleague.token));

    expect(res.status).toBe(403);
  }, 30_000);
});
