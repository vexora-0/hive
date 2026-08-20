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

/**
 * Diary tests — the same privacy boundary as the feed, plus the two things the
 * diary adds that nothing else in the API does: it groups by **the parent's**
 * calendar rather than the server's, and it is scoped to exactly one child.
 *
 * Its own school and family, deliberately separate from the feed's fixtures
 * above: the assertions here count photographs per month, so they cannot share
 * a roster with tests that add rows for other reasons.
 */
describe('parent diary', () => {
  let school: string, otherSchool: string;
  let klass: string, otherClass: string;
  let teacher: TestUser, parent: TestUser, stranger: TestUser;
  let child: string, sibling: string, otherChild: string;
  /** A child with one photograph, taken half an hour past midnight UTC. */
  let edgeChild: string;

  // Fixed instants in the past, so "today" can never drift into them and the
  // month buckets are the same on every run.
  const MAR_4_MORNING = '2024-03-04T09:00:00.000Z';
  const MAR_4_LATE = '2024-03-04T11:30:00.000Z';
  const MAR_19 = '2024-03-19T08:15:00.000Z';
  const MAY_2 = '2024-05-02T07:45:00.000Z';
  /** 00:30 UTC on the 1st — the same instant is 31 March west of Greenwich. */
  const APR_1_EDGE = '2024-04-01T00:30:00.000Z';

  beforeAll(async () => {
    school = await createTestSchool('Diary School');
    otherSchool = await createTestSchool('Diary Other School');
    klass = await createTestClass(school);
    otherClass = await createTestClass(otherSchool);

    teacher = await createTestUser('teacher', school);
    parent = await createTestUser('parent', school);
    stranger = await createTestUser('parent', otherSchool);

    child = await createTestStudent(school, klass, 'Diary Child');
    sibling = await createTestStudent(school, klass, 'Diary Sibling');
    edgeChild = await createTestStudent(school, klass, 'Diary Edge Child');
    otherChild = await createTestStudent(otherSchool, otherClass, 'Other Child');

    await linkParent(parent.id, child);
    await linkParent(parent.id, sibling);
    await linkParent(parent.id, edgeChild);
    await linkParent(stranger.id, otherChild);

    // Three photographs in March across two days, one in May.
    for (const [createdAt, caption] of [
      [MAR_4_MORNING, 'First morning in the sandpit'],
      [MAR_4_LATE, undefined],
      [MAR_19, undefined],
      [MAY_2, undefined],
    ] as Array<[string, string | undefined]>) {
      const id = await createTestPhoto({
        schoolId: school,
        classId: klass,
        uploadedBy: teacher.id,
        createdAt,
        caption,
      });
      await tagStudent(id, child, teacher.id);
      await setPhotoReady(id);
    }

    // The sibling's own photograph, in a month the first child has nothing in.
    // Nothing of it may appear in the first child's diary.
    const siblingPhoto = await createTestPhoto({
      schoolId: school,
      classId: klass,
      uploadedBy: teacher.id,
      createdAt: '2024-07-01T09:00:00.000Z',
    });
    await tagStudent(siblingPhoto, sibling, teacher.id);
    await setPhotoReady(siblingPhoto);

    const edgePhoto = await createTestPhoto({
      schoolId: school,
      classId: klass,
      uploadedBy: teacher.id,
      createdAt: APR_1_EDGE,
    });
    await tagStudent(edgePhoto, edgeChild, teacher.id);
    await setPhotoReady(edgePhoto);
  }, 60_000);

  afterAll(cleanupUsers);

  const diary = (token: string, studentId: string, tzOffset = 0) =>
    request(app)
      .get(`/api/v1/feed/diary?studentId=${studentId}&tzOffset=${tzOffset}`)
      .set(bearer(token));

  it('returns the whole journey as months, oldest first', async () => {
    const res = await diary(parent.token, child);

    expect(res.status).toBe(200);
    const { chapters, summary, student } = res.body.data;

    expect(student.id).toBe(child);
    expect(chapters.map((c: { month: string }) => c.month)).toEqual([
      '2024-03',
      '2024-05',
    ]);

    // March: three photographs over two days. The distinction matters — the
    // strand plots counts and the entries list days, and conflating them was
    // the easiest thing in this service to get wrong.
    expect(chapters[0].photoCount).toBe(3);
    expect(chapters[0].dayCount).toBe(2);
    expect(chapters[1].photoCount).toBe(1);
    expect(chapters[1].dayCount).toBe(1);

    expect(summary.totalPhotos).toBe(4);
    expect(summary.totalDays).toBe(3);
    // Compared as instants, not as strings. Postgres emits
    // `2024-03-04T09:00:00+00:00` and the service passes it through verbatim —
    // deliberately, for the same reason `utils/cursor` refuses to re-serialise
    // a timestamp. Asserting the JS `…000Z` spelling would be testing
    // `toISOString`, not the diary.
    expect(Date.parse(summary.firstPhotoAt)).toBe(Date.parse(MAR_4_MORNING));
    expect(summary.truncated).toBe(false);
  });

  it('gives every month a signed cover print', async () => {
    const res = await diary(parent.token, child);

    for (const chapter of res.body.data.chapters) {
      expect(chapter.cover).not.toBeNull();
      expect(chapter.cover.url).toContain('token=');
    }
  });

  /**
   * A diary is one child's. A sibling's photographs interleaved into it would
   * make "Day 40" a claim about whichever of them started first.
   */
  it('never mixes a sibling into a child\'s diary', async () => {
    const res = await diary(parent.token, child);

    const months = res.body.data.chapters.map((c: { month: string }) => c.month);
    expect(months).not.toContain('2024-07');
  });

  it('returns 404 for a child the caller is not a parent of', async () => {
    const res = await diary(stranger.token, child);

    // 404 rather than 403 — a 403 confirms the child exists.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(child);
  });

  it('requires a studentId', async () => {
    const res = await request(app)
      .get('/api/v1/feed/diary')
      .set(bearer(parent.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed studentId with 400 rather than 500', async () => {
    const res = await request(app)
      .get('/api/v1/feed/diary?studentId=not-a-uuid')
      .set(bearer(parent.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a teacher reading a diary', async () => {
    const res = await diary(teacher.token, child);
    expect(res.status).toBe(403);
  });

  /**
   * The reason `tzOffset` exists.
   *
   * One photograph at 00:30 UTC on 1 April. Bucketed in UTC it is April; on a
   * clock one hour behind UTC it is half eleven at night on 31 March, and the
   * parent looking at it would be shown a March photograph filed under April.
   */
  it('buckets months in the viewer\'s calendar, not the server\'s', async () => {
    const utc = await diary(parent.token, edgeChild, 0);
    expect(utc.body.data.chapters.map((c: { month: string }) => c.month)).toEqual([
      '2024-04',
    ]);

    // getTimezoneOffset() is UTC minus local, so +60 is one hour behind UTC.
    const behind = await diary(parent.token, edgeChild, 60);
    expect(behind.body.data.chapters.map((c: { month: string }) => c.month)).toEqual([
      '2024-03',
    ]);
  });

  describe('a chapter', () => {
    it('groups a month into the days it happened on', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/diary/2024-03?studentId=${child}&tzOffset=0`)
        .set(bearer(parent.token));

      expect(res.status).toBe(200);
      const { entries, truncated } = res.body.data;

      expect(truncated).toBe(false);
      expect(entries.map((e: { date: string }) => e.date)).toEqual([
        '2024-03-04',
        '2024-03-19',
      ]);

      const [firstDay] = entries;
      expect(firstDay.photoCount).toBe(2);
      // Instants, not strings — see the note in the outline test above.
      expect(Date.parse(firstDay.firstAt)).toBe(Date.parse(MAR_4_MORNING));
      expect(Date.parse(firstDay.lastAt)).toBe(Date.parse(MAR_4_LATE));
      expect(firstDay.teachers).toEqual([teacher.fullName]);
      expect(firstDay.photos[0].caption).toBe('First morning in the sandpit');
      expect(firstDay.photos[0].url).toContain('token=');
    });

    it('returns an empty month rather than failing', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/diary/2024-04?studentId=${child}&tzOffset=0`)
        .set(bearer(parent.token));

      expect(res.status).toBe(200);
      expect(res.body.data.entries).toEqual([]);
    });

    it('returns 404 for a child the caller is not a parent of', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/diary/2024-03?studentId=${child}&tzOffset=0`)
        .set(bearer(stranger.token));

      expect(res.status).toBe(404);
    });

    it('rejects a malformed month with 400 rather than 500', async () => {
      for (const month of ['2024-13', 'March', '2024-3', '2024-03-04']) {
        const res = await request(app)
          .get(`/api/v1/feed/diary/${month}?studentId=${child}&tzOffset=0`)
          .set(bearer(parent.token));

        expect(res.status).toBe(400);
      }
    });

    it('rejects a tzOffset outside any real timezone', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/diary/2024-03?studentId=${child}&tzOffset=99999`)
        .set(bearer(parent.token));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
