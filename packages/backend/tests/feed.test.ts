import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  createTestUser,
  createTestSchool,
  createTestClass,
  createTestStudent,
  createTestPhoto,
  linkParent,
  tagStudent,
  setPhotoReady,
  cleanupUsers,
  bearer,
  type TestUser,
} from './helpers';

/**
 * Feed tests — the privacy boundary of the product.
 *
 * Two schools with two unrelated families. Every assertion here is about one
 * question: can a parent reach a photo that is not of their own child?
 */
describe('parent feed', () => {
  let schoolA: string, schoolB: string;
  let classA: string, classB: string;
  let teacherA: TestUser, parentA: TestUser, parentB: TestUser;
  let childA1: string, childA2: string, childB: string;
  let photoOfA1: string, photoOfB: string, photoOfBothA: string;

  beforeAll(async () => {
    schoolA = await createTestSchool('School A');
    schoolB = await createTestSchool('School B');
    classA = await createTestClass(schoolA);
    classB = await createTestClass(schoolB);

    teacherA = await createTestUser('teacher', schoolA);
    parentA = await createTestUser('parent', schoolA);
    parentB = await createTestUser('parent', schoolB);

    // Parent A has two children — exercises the sibling-dedup path.
    childA1 = await createTestStudent(schoolA, classA, 'Child A1');
    childA2 = await createTestStudent(schoolA, classA, 'Child A2');
    childB = await createTestStudent(schoolB, classB, 'Child B');

    await linkParent(parentA.id, childA1);
    await linkParent(parentA.id, childA2);
    await linkParent(parentB.id, childB);

    photoOfA1 = await createTestPhoto({ schoolId: schoolA, classId: classA, uploadedBy: teacherA.id });
    await tagStudent(photoOfA1, childA1, teacherA.id);
    await setPhotoReady(photoOfA1);

    photoOfB = await createTestPhoto({ schoolId: schoolB, classId: classB, uploadedBy: teacherA.id });
    await tagStudent(photoOfB, childB, teacherA.id);
    await setPhotoReady(photoOfB);

    // Both of parent A's children in one photo.
    photoOfBothA = await createTestPhoto({ schoolId: schoolA, classId: classA, uploadedBy: teacherA.id });
    await tagStudent(photoOfBothA, childA1, teacherA.id);
    await tagStudent(photoOfBothA, childA2, teacherA.id);
    await setPhotoReady(photoOfBothA);
  }, 60_000);

  afterAll(cleanupUsers);

  // T-10 — the core privacy guarantee
  it('returns only photos tagged with the parent\'s own children', async () => {
    const res = await request(app).get('/api/v1/feed').set(bearer(parentA.token));

    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(photoOfA1);
    expect(ids).not.toContain(photoOfB);
  });

  // T-6 — cross-parent access must not reveal existence
  it('returns 404 when a parent requests another family\'s photo', async () => {
    const res = await request(app)
      .get(`/api/v1/feed/photos/${photoOfB}`)
      .set(bearer(parentA.token));

    // 404 rather than 403 — a 403 confirms the photo exists, which is itself
    // an information leak.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(photoOfB);
  });

  // T-11 — unprocessed photos must not leak
  it('excludes photos that are not ready', async () => {
    const pending = await createTestPhoto({
      schoolId: schoolA,
      classId: classA,
      uploadedBy: teacherA.id,
      status: 'processing',
    });
    await tagStudent(pending, childA1, teacherA.id);

    const res = await request(app).get('/api/v1/feed').set(bearer(parentA.token));
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(pending);
  });

  // T-13 — regression guard for the dedup bug in the deleted getParentFeed
  it('returns a photo once even when two of the parent\'s children are tagged', async () => {
    const res = await request(app).get('/api/v1/feed').set(bearer(parentA.token));
    const occurrences = res.body.data.filter(
      (p: { id: string }) => p.id === photoOfBothA,
    ).length;

    expect(occurrences).toBe(1);
  });

  // T-13b — a parent must not learn which other children appear
  it('reports only the requesting parent\'s children as tagged', async () => {
    const otherChild = await createTestStudent(schoolA, classA, 'Unrelated Child');
    await tagStudent(photoOfA1, otherChild, teacherA.id);

    const res = await request(app).get('/api/v1/feed').set(bearer(parentA.token));
    const photo = res.body.data.find((p: { id: string }) => p.id === photoOfA1);

    expect(photo.taggedStudentIds).toContain(childA1);
    expect(photo.taggedStudentIds).not.toContain(otherChild);
  });

  // T-12 — cursor pagination must not duplicate or skip
  it('paginates without duplicates across pages', async () => {
    const extra: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = await createTestPhoto({ schoolId: schoolA, classId: classA, uploadedBy: teacherA.id });
      await tagStudent(id, childA1, teacherA.id);
      await setPhotoReady(id);
      extra.push(id);
    }

    const page1 = await request(app).get('/api/v1/feed?limit=10').set(bearer(parentA.token));
    expect(page1.status).toBe(200);
    expect(page1.body.cursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/v1/feed?limit=10&cursor=${encodeURIComponent(page1.body.cursor)}`)
      .set(bearer(parentA.token));
    expect(page2.status).toBe(200);

    const ids1 = page1.body.data.map((p: { id: string }) => p.id);
    const ids2 = page2.body.data.map((p: { id: string }) => p.id);
    expect(ids1).toHaveLength(10);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
  }, 60_000);

  it('rejects an unauthenticated feed request', async () => {
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(401);
  });

  /**
   * Both feed routes carried no validator at all: `studentId` went from the
   * query string straight into `.eq('student_id', …)`, so a malformed value
   * came back as a 500 from PostgREST rather than the 400 the caller earned.
   */
  it('rejects a malformed studentId with 400 rather than 500', async () => {
    const res = await request(app)
      .get('/api/v1/feed?studentId=not-a-uuid')
      .set(bearer(parentA.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed photo id on the detail route with 400 rather than 500', async () => {
    const res = await request(app)
      .get('/api/v1/feed/photos/not-a-uuid')
      .set(bearer(parentA.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Cursors are decoded here too, and the same wrong-shape cursor that used to
   * become a 500 must be a 400. Valid base64 of valid JSON, missing `id`.
   */
  it('rejects a cursor of the wrong shape with 400 rather than 500', async () => {
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: '2026-08-09T12:00:00.123456+00:00' }),
    ).toString('base64url');

    const res = await request(app)
      .get(`/api/v1/feed?cursor=${encodeURIComponent(cursor)}`)
      .set(bearer(parentA.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  });

  it('rejects a teacher reading the parent feed', async () => {
    const res = await request(app).get('/api/v1/feed').set(bearer(teacherA.token));
    expect(res.status).toBe(403);
  });
});
