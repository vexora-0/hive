import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../src/app';
import { supabaseTest } from './setup';
import {
  createTestUser,
  createTestSchool,
  createTestClass,
  createTestStudent,
  cleanupUsers,
  registerCreatedSchool,
  bearer,
  type TestUser,
} from './helpers';

/** The HTTP verbs the path-parameter table below drives supertest with. */
type Method = 'get' | 'post' | 'patch' | 'delete';

/**
 * The admin console.
 *
 * Plan 08 specified this file and it was never written, so the whole admin
 * surface — the one with `roleGuard('admin')` on every route and the search
 * filter that G-16 was about — had no automated coverage.
 */
describe('admin console', () => {
  let school: string, otherSchool: string, classId: string, otherClassId: string;
  let admin: TestUser, teacher: TestUser, parent: TestUser;
  let otherSchoolTeacher: TestUser;
  let student: string;

  beforeAll(async () => {
    school = await createTestSchool('Admin School');
    otherSchool = await createTestSchool('Second School');
    classId = await createTestClass(school);
    // The cross-school integrity cases all need a class and a teacher that
    // belong to a *different* school from the one being operated on.
    otherClassId = await createTestClass(otherSchool);

    admin = await createTestUser('admin', school);
    teacher = await createTestUser('teacher', school);
    parent = await createTestUser('parent', school);
    otherSchoolTeacher = await createTestUser('teacher', otherSchool);

    student = await createTestStudent(school, classId, 'Admin Child');
  }, 60_000);

  afterAll(cleanupUsers);

  // ── Role guard ──────────────────────────────────────────────────────

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it.each([
    ['/api/v1/admin/dashboard'],
    ['/api/v1/admin/users'],
    ['/api/v1/admin/schools'],
    ['/api/v1/admin/teachers'],
  ])('rejects a teacher reading %s', async (path) => {
    const res = await request(app).get(path).set(bearer(teacher.token));
    expect(res.status).toBe(403);
  });

  it('rejects a parent reading the admin dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set(bearer(parent.token));
    expect(res.status).toBe(403);
  });

  // ── Dashboard ───────────────────────────────────────────────────────

  /**
   * G-06: the dashboard selected a column that does not exist, so every tile
   * read zero. Asserting the shape catches a rename; asserting the school
   * count is non-zero catches the query silently failing.
   */
  it('returns dashboard statistics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalSchools: expect.any(Number),
      totalUsers: expect.any(Number),
      totalPhotos: expect.any(Number),
      totalOrders: expect.any(Number),
      totalRevenue: expect.any(Number),
    });
    expect(res.body.data.totalSchools).toBeGreaterThan(0);
  }, 30_000);

  // ── Users ───────────────────────────────────────────────────────────

  it('lists users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 30_000);

  it('filters users by role', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?role=teacher')
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(
      res.body.data.every((u: { role: string }) => u.role === 'teacher'),
    ).toBe(true);
  }, 30_000);

  /**
   * G-16: `search` was interpolated straight into a PostgREST `.or()` filter,
   * so a comma or parenthesis let a caller rewrite the query. The metacharacters
   * are stripped now — the request must come back 200 with a sane body rather
   * than a 500 or somebody else's rows.
   */
  it.each([
    ['a,b'],
    ['a)b'],
    ['a(b'],
    ['*'],
    ['%'],
    ['a.b'],
    ['role.eq.admin'],
  ])('handles %s in the user search without erroring', async (term) => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(term)}`)
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 30_000);

  it('rejects an invalid role filter', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?role=superuser')
      .set(bearer(admin.token));

    expect(res.status).toBe(400);
  });

  // G-09: school_admin is not in the profiles.role CHECK constraint.
  it('rejects the retired school_admin role', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${teacher.id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'school_admin' });

    expect(res.status).toBe(400);
  }, 30_000);

  it('changes a user\'s role', async () => {
    const subject = await createTestUser('parent', school);

    const res = await request(app)
      .patch(`/api/v1/admin/users/${subject.id}/role`)
      .set(bearer(admin.token))
      .send({ role: 'teacher' });

    expect(res.status).toBe(200);

    const { data: profile } = await supabaseTest
      .from('profiles')
      .select('role')
      .eq('id', subject.id)
      .single();
    expect(profile?.role).toBe('teacher');
  }, 30_000);

  // ── Schools ─────────────────────────────────────────────────────────

  it('creates a school', async () => {
    const name = `Created ${randomUUID().slice(0, 8)}`;

    const res = await request(app)
      .post('/api/v1/admin/schools')
      .set(bearer(admin.token))
      .send({ name, address: '2 Test Road' });

    registerCreatedSchool(res.body?.data?.id);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(name);
  }, 30_000);

  it('rejects a school with no name', async () => {
    const res = await request(app)
      .post('/api/v1/admin/schools')
      .set(bearer(admin.token))
      .send({ address: 'nowhere' });

    expect(res.status).toBe(400);
  });

  /**
   * M-9: `updateSchoolSchema` existed from the start and no route used it, so
   * a school's details could be set once and never corrected.
   */
  it('updates a school\'s details', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/schools/${otherSchool}`)
      .set(bearer(admin.token))
      .send({ name: 'Renamed School', address: '9 New Street' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed School');
    expect(res.body.data.address).toBe('9 New Street');
  }, 30_000);

  it('updates only the fields supplied', async () => {
    const created = await request(app)
      .post('/api/v1/admin/schools')
      .set(bearer(admin.token))
      .send({ name: 'Partial School', address: 'Keep this address' });
    registerCreatedSchool(created.body?.data?.id);
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/admin/schools/${created.body.data.id}`)
      .set(bearer(admin.token))
      .send({ name: 'Partial School Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Partial School Renamed');
    expect(res.body.data.address).toBe('Keep this address');
  }, 30_000);

  it('returns 404 updating a school that does not exist', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/schools/${randomUUID()}`)
      .set(bearer(admin.token))
      .send({ name: 'Ghost School' });

    expect(res.status).toBe(404);
  }, 30_000);

  it('rejects a malformed school id', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/schools/not-a-uuid')
      .set(bearer(admin.token))
      .send({ name: 'Whatever' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a teacher updating a school', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/schools/${school}`)
      .set(bearer(teacher.token))
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  }, 30_000);

  // ── Classes and students ────────────────────────────────────────────

  it('returns class detail with students', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/classes/${classId}`)
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.students)).toBe(true);
  }, 30_000);

  it('rejects assigning a non-teacher as a class teacher', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/classes/${classId}/teacher`)
      .set(bearer(admin.token))
      .send({ teacherId: parent.id });

    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 30_000);

  it('assigns a teacher to a class', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/classes/${classId}/teacher`)
      .set(bearer(admin.token))
      .send({ teacherId: teacher.id });

    expect(res.status).toBe(200);
  }, 30_000);

  it('returns 404 mapping a parent who has not signed up', async () => {
    const studentId = await createTestStudent(school, classId, 'Unmapped Child');

    const res = await request(app)
      .post(`/api/v1/admin/students/${studentId}/parents`)
      .set(bearer(admin.token))
      .send({ email: `nobody.${randomUUID().slice(0, 8)}@hive.test` });

    expect(res.status).toBe(404);
  }, 30_000);

  // ── Silent no-ops ───────────────────────────────────────────────────
  //
  // PostgREST does not treat "matched no rows" as an error, so each of these
  // used to issue its update or delete, read only `error`, and answer 200 with
  // a success message having changed nothing at all.

  it('404s assigning a teacher to a class that does not exist', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/classes/${randomUUID()}/teacher`)
      .set(bearer(admin.token))
      .send({ teacherId: teacher.id });

    expect(res.status).toBe(404);
  }, 30_000);

  it('404s removing a student from a class they are not in', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/classes/${otherClassId}/students/${student}`)
      .set(bearer(admin.token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_IN_CLASS');
  }, 30_000);

  /**
   * The no-op that matters most. Unlinking is a revocation, so "it said it
   * worked" has to mean it worked — the console showed the parent removed
   * while they could still see every photo of the child.
   */
  it('404s removing a parent mapping that does not exist', async () => {
    const stranger = await createTestUser('parent', school);

    const res = await request(app)
      .delete(`/api/v1/admin/students/${student}/parents/${stranger.id}`)
      .set(bearer(admin.token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MAPPING_NOT_FOUND');
  }, 30_000);

  // ── Cross-school integrity ──────────────────────────────────────────

  /**
   * A mismatch here is silent but live: the roster is filtered by school_id, so
   * the child never appears in their own teacher's list and cannot be tagged in
   * their own class's photos.
   */
  it('refuses to create a student in a class at another school', async () => {
    const res = await request(app)
      .post('/api/v1/admin/students')
      .set(bearer(admin.token))
      .send({ fullName: 'Misfiled Child', schoolId: school, classId: otherClassId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SCHOOL_MISMATCH');
  }, 30_000);

  // The same check on the other route that reaches createStudent — this one
  // takes the class from the URL and the school from the body.
  it('refuses to add a student to a class at another school', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/classes/${otherClassId}/students`)
      .set(bearer(admin.token))
      .send({ fullName: 'Misfiled Child', schoolId: school });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SCHOOL_MISMATCH');
  }, 30_000);

  /**
   * Putting a teacher in front of another school's class hands them the roster,
   * dates of birth included.
   */
  it('refuses to assign a teacher from another school to a class', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/classes/${classId}/teacher`)
      .set(bearer(admin.token))
      .send({ teacherId: otherSchoolTeacher.id });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SCHOOL_MISMATCH');
  }, 30_000);

  // ── Parent mapping ──────────────────────────────────────────────────

  /**
   * The role was fetched here and then ignored. The photo feed is scoped by
   * parent_student_mappings alone, so mapping a teacher's account to a student
   * handed that account the child's photos through the parent surface.
   */
  it('refuses to link a non-parent account as a parent', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/students/${student}/parents`)
      .set(bearer(admin.token))
      .send({ email: teacher.email });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_A_PARENT');
  }, 30_000);

  /**
   * A parent signs up with no school — the signup trigger cannot know one — and
   * `createOrder` refuses anyone without a school_id. Nothing else ever set it,
   * so a real parent could be linked to their child, browse the feed, and still
   * be unable to buy a print. Only the demo seed, which writes school_id
   * directly, hid this.
   */
  it('back-fills a linked parent\'s school so they can order', async () => {
    const newcomer = await createTestUser('parent', null);
    const childId = await createTestStudent(school, classId, 'Newcomer Child');

    const res = await request(app)
      .post(`/api/v1/admin/students/${childId}/parents`)
      .set(bearer(admin.token))
      .send({ email: newcomer.email });

    expect(res.status).toBe(201);

    const { data: profile } = await supabaseTest
      .from('profiles')
      .select('school_id')
      .eq('id', newcomer.id)
      .single();
    expect(profile?.school_id).toBe(school);
  }, 30_000);

  // ── Malformed input reaches Postgres as a 400, not a 500 ────────────

  /**
   * Nine admin routes passed a path parameter straight into a `.eq()` filter,
   * so a malformed ID came back as an unhandled driver error — a 500 for a
   * request the caller plainly got wrong. `params.validator` already exported
   * schemas for most of these and no route used them.
   */
  it.each<[Method, string]>([
    ['patch', '/api/v1/admin/users/not-a-uuid/role'],
    ['patch', '/api/v1/admin/users/not-a-uuid/school'],
    ['patch', '/api/v1/admin/schools/not-a-uuid'],
    ['get', '/api/v1/admin/classes/not-a-uuid'],
    ['patch', '/api/v1/admin/classes/not-a-uuid/teacher'],
    ['post', '/api/v1/admin/classes/not-a-uuid/students'],
    ['delete', '/api/v1/admin/classes/not-a-uuid/students/also-not-a-uuid'],
    ['get', '/api/v1/admin/students/not-a-uuid/parents'],
    ['post', '/api/v1/admin/students/not-a-uuid/parents'],
    ['delete', '/api/v1/admin/students/not-a-uuid/parents/also-not-a-uuid'],
    ['patch', '/api/v1/admin/orders/not-a-uuid/status'],
  ])('rejects a malformed id on %s %s', async (method, path) => {
    const res = await request(app)[method](path).set(bearer(admin.token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  }, 30_000);

  it('rejects a cursor of the wrong shape with 400 rather than 500', async () => {
    // Valid base64, valid JSON, no `id` — the shape that used to interpolate
    // the string "undefined" into a PostgREST filter.
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: '2026-08-09T12:00:00.123456+00:00' }),
    ).toString('base64url');

    const res = await request(app)
      .get(`/api/v1/admin/users?cursor=${encodeURIComponent(cursor)}`)
      .set(bearer(admin.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  }, 30_000);
});

/**
 * The caller's own profile.
 *
 * `PATCH /me` is deliberately narrow: it must never accept `role` or
 * `school_id`, because a self-service endpoint that did would be a privilege
 * escalation in a single request.
 */
describe('own profile', () => {
  let school: string;
  let parent: TestUser;

  beforeAll(async () => {
    school = await createTestSchool('Profile School');
    parent = await createTestUser('parent', school);
  }, 60_000);

  afterAll(cleanupUsers);

  it('rejects an unauthenticated read', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('returns the caller\'s own profile', async () => {
    const res = await request(app).get('/api/v1/me').set(bearer(parent.token));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(parent.id);
    expect(res.body.data.email).toBe(parent.email);
    expect(res.body.data.role).toBe('parent');
  }, 30_000);

  it('updates the name and phone', async () => {
    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ fullName: 'Renamed Parent', phone: '+1 555 0100' });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Renamed Parent');
    expect(res.body.data.phone).toBe('+1 555 0100');
  }, 30_000);

  it('clears the phone when sent null', async () => {
    await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ phone: '+1 555 0101' });

    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ phone: null });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBeNull();
  }, 30_000);

  /**
   * The escalation case. `role` is not in the schema, so it is stripped by
   * `validate` before the service ever sees it — the request succeeds and the
   * role is unchanged.
   */
  it('ignores an attempt to change your own role', async () => {
    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ fullName: 'Still A Parent', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('parent');

    const { data: profile } = await supabaseTest
      .from('profiles')
      .select('role')
      .eq('id', parent.id)
      .single();
    expect(profile?.role).toBe('parent');
  }, 30_000);

  it('ignores an attempt to move yourself to another school', async () => {
    const elsewhere = await createTestSchool('Elsewhere');

    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ fullName: 'Still Here', schoolId: elsewhere });

    expect(res.status).toBe(200);
    expect(res.body.data.school_id).toBe(school);
  }, 30_000);

  it('rejects an empty body', async () => {
    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects an empty name', async () => {
    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ fullName: '' });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed phone number', async () => {
    const res = await request(app)
      .patch('/api/v1/me')
      .set(bearer(parent.token))
      .send({ phone: 'not a phone' });

    expect(res.status).toBe(400);
  });
});
