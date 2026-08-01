import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
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
 * Every remediation in docs/security.md §4, as a test.
 *
 * scripts/verify-security.sh proves these once, by hand, against whatever data
 * happens to be seeded. This file proves them on every run against a known
 * fixture, which is the difference between "we checked" and "it cannot
 * regress".
 *
 * The fixture is deliberately awkward: school X has TWO teachers. G-17 is
 * about one teacher mutating another's photo, and assertPhotoAccess requires
 * uploader AND school to match — so a probe using teachers at different
 * schools is refused by the school half and never reaches the ownership half.
 * That is exactly the shape the manual script had, and it is why
 * IMPLEMENTATION-STATUS.md records G-17 as unverified while everything around
 * it is confirmed.
 */
describe('authorization', () => {
  let schoolX: string, schoolY: string;
  let classX: string, classY: string;
  let teacherX: TestUser, teacherX2: TestUser, teacherY: TestUser;
  let parentX: TestUser, parentY: TestUser;
  let adminUser: TestUser;
  let childX: string, childY: string;
  let photoOfX: string, photoOfY: string;

  beforeAll(async () => {
    schoolX = await createTestSchool('School X');
    schoolY = await createTestSchool('School Y');
    classX = await createTestClass(schoolX);
    classY = await createTestClass(schoolY);

    teacherX = await createTestUser('teacher', schoolX);
    teacherX2 = await createTestUser('teacher', schoolX); // same school as X
    teacherY = await createTestUser('teacher', schoolY);
    parentX = await createTestUser('parent', schoolX);
    parentY = await createTestUser('parent', schoolY);
    adminUser = await createTestUser('admin', null);

    childX = await createTestStudent(schoolX, classX, 'Child X');
    childY = await createTestStudent(schoolY, classY, 'Child Y');
    await linkParent(parentX.id, childX);
    await linkParent(parentY.id, childY);

    photoOfX = await createTestPhoto({
      schoolId: schoolX,
      classId: classX,
      uploadedBy: teacherX.id,
    });
    await tagStudent(photoOfX, childX, teacherX.id);
    await setPhotoReady(photoOfX);

    photoOfY = await createTestPhoto({
      schoolId: schoolY,
      classId: classY,
      uploadedBy: teacherY.id,
    });
    await tagStudent(photoOfY, childY, teacherY.id);
    await setPhotoReady(photoOfY);
  }, 60_000);

  afterAll(cleanupUsers);

  // ─── G-08 — cross-school IDOR ────────────────────────────────────────────
  describe('G-08 — a teacher cannot read another school', () => {
    it('refuses another school\'s class list', async () => {
      const res = await request(app)
        .get(`/api/v1/schools/${schoolY}/classes`)
        .set(bearer(teacherX.token));
      expect(res.status).toBe(403);
    });

    it('refuses another school\'s student roster', async () => {
      const res = await request(app)
        .get(`/api/v1/schools/${schoolY}/students`)
        .set(bearer(teacherX.token));

      // The roster carries dates of birth, which is what made this High.
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(childY);
    });

    it('refuses photos filtered to another school\'s class', async () => {
      const res = await request(app)
        .get(`/api/v1/photos?classId=${classY}`)
        .set(bearer(teacherX.token));
      expect(res.status).toBe(403);
    });

    // Over-refusal is a failure too. A guard that refuses everyone is not a
    // fix, and this is the assertion that would catch it.
    it('still allows a teacher their own school', async () => {
      const res = await request(app)
        .get(`/api/v1/schools/${schoolX}/students`)
        .set(bearer(teacherX.token));
      expect(res.status).toBe(200);
    });

    it('still allows an admin any school', async () => {
      const res = await request(app)
        .get(`/api/v1/schools/${schoolY}/students`)
        .set(bearer(adminUser.token));
      expect(res.status).toBe(200);
    });
  });

  // ─── G-17 — photo mutation ownership, same school ────────────────────────
  describe('G-17 — a teacher cannot mutate a colleague\'s photo', () => {
    // Both teachers are at school X, so the school check passes and the
    // uploader check is the only thing that can refuse. This is the case the
    // manual script could not reach.
    it('refuses confirming a colleague\'s photo', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${photoOfX}/confirm`)
        .set(bearer(teacherX2.token));
      expect(res.status).toBe(403);
    });

    it('refuses tagging on a colleague\'s photo', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${photoOfX}/tag`)
        .set(bearer(teacherX2.token))
        .send({ studentIds: [childX] });
      expect(res.status).toBe(403);
    });

    it('refuses overwriting a colleague\'s photo file', async () => {
      const fixture = readFileSync(join(__dirname, 'fixtures', 'valid.jpg'));
      const res = await request(app)
        .post(`/api/v1/photos/${photoOfX}/file`)
        .set(bearer(teacherX2.token))
        .attach('file', fixture, 'valid.jpg');
      expect(res.status).toBe(403);
    });

    it('allows the uploader to tag their own photo', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${photoOfX}/tag`)
        .set(bearer(teacherX.token))
        .send({ studentIds: [childX] });
      expect(res.status).toBe(200);
    });

    it('allows an admin to act on any photo', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${photoOfX}/tag`)
        .set(bearer(adminUser.token))
        .send({ studentIds: [childX] });
      expect(res.status).toBe(200);
    });
  });

  // ─── G-05 — role separation, server side ─────────────────────────────────
  describe('G-05 — role separation is enforced by the server', () => {
    it.each([
      ['/api/v1/admin/dashboard'],
      ['/api/v1/admin/users'],
      ['/api/v1/admin/schools'],
    ])('refuses a parent at %s', async (path) => {
      const res = await request(app).get(path).set(bearer(parentX.token));

      // 403, not 401. lib/api.ts signs out on 401, so answering 401 here would
      // log out anyone who touched another role's route.
      expect(res.status).toBe(403);
    });

    it('refuses a teacher on the admin console', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set(bearer(teacherX.token));
      expect(res.status).toBe(403);
    });

    it('answers 401, not 403, when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('still admits an admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set(bearer(adminUser.token));
      expect(res.status).toBe(200);
    });
  });

  // ─── G-04 — photo detail, and the ordering that makes it work ────────────
  describe('G-04 — photo detail does not leak across families', () => {
    it('refuses another family\'s photo with 404, not 403', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/photos/${photoOfY}`)
        .set(bearer(parentX.token));

      // 403 would confirm the photo exists, and UUIDs are enumerable.
      expect(res.status).toBe(404);
    });

    /**
     * The ownership check must run BEFORE the signed URL is minted. A signed
     * URL is a bearer credential for the file itself, so generating one for a
     * caller who is then refused hands over exactly what the check exists to
     * prevent. Reordering those two statements is an easy, silent mistake —
     * the status code stays 404 and only the body gives it away.
     */
    it('mints no signed URL in a refused response', async () => {
      const res = await request(app)
        .get(`/api/v1/feed/photos/${photoOfY}`)
        .set(bearer(parentX.token));

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('token=');
      expect(body).not.toMatch(/https?:\/\/[^"]*supabase/i);
    });

    it('reports only the caller\'s own children as tagged', async () => {
      // A second family's child on the same photo. Parent X may see the photo,
      // but must not learn who else is in it (G-04b).
      const otherChild = await createTestStudent(schoolX, classX, 'Other Child');
      await tagStudent(photoOfX, otherChild, teacherX.id);

      const res = await request(app)
        .get(`/api/v1/feed/photos/${photoOfX}`)
        .set(bearer(parentX.token));

      expect(res.status).toBe(200);
      expect(res.body.data.taggedStudentIds).toContain(childX);
      expect(res.body.data.taggedStudentIds).not.toContain(otherChild);
    });
  });

  // ─── G-16 — PostgREST filter injection in admin search ───────────────────
  describe('G-16 — admin user search does not pass a filter DSL through', () => {
    it('treats PostgREST metacharacters as text', async () => {
      // Unescaped, this closes the ilike and appends a second filter — the
      // shape that made the original .or() interpolation exploitable.
      const payload = encodeURIComponent('*),role.eq.admin,(email.ilike.*');
      const res = await request(app)
        .get(`/api/v1/admin/users?search=${payload}`)
        .set(bearer(adminUser.token));

      // A 500 would mean the string reached the driver; a full user list would
      // mean the injected filter ran.
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
