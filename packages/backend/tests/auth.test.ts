import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

import app from '../src/app';
import {
  createTestUser,
  createTestSchool,
  cleanupUsers,
  type TestUser,
} from './helpers';

/**
 * T-1 … T-5 — authentication and role-based access control.
 *
 * These exercise `middleware/auth.ts` and `middleware/roleGuard.ts` over HTTP
 * with real Supabase-issued tokens. Asserting against the service-role client
 * instead would prove nothing: the API's entire authorization story is that
 * these two middlewares run, because `supabaseAdmin` bypasses RLS.
 */
describe('authentication and RBAC', () => {
  let schoolA: string;
  let teacher: TestUser;
  let parent: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    schoolA = await createTestSchool('School A');
    teacher = await createTestUser('teacher', schoolA);
    parent = await createTestUser('parent', schoolA);
    admin = await createTestUser('admin', null);
  });

  afterAll(async () => {
    await cleanupUsers();
  });

  // -------------------------------------------------------------------------
  // T-1
  // -------------------------------------------------------------------------

  it('T-1: rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/notifications');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('T-1b: rejects an Authorization header that is not a Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  // -------------------------------------------------------------------------
  // T-2
  // -------------------------------------------------------------------------

  it('T-2: rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('T-2b: rejects a well-formed but invalid JWT', async () => {
    // Structurally a JWT — three base64url segments — but not signed by
    // Supabase. Catches an implementation that only checks the shape.
    const fakeJwt = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiYWRtaW4ifQ',
      'bm90LWEtcmVhbC1zaWduYXR1cmU',
    ].join('.');

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${fakeJwt}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  // -------------------------------------------------------------------------
  // T-3
  // -------------------------------------------------------------------------

  it('T-3: a valid token is accepted and the role comes from profiles', async () => {
    // The admin dashboard is behind roleGuard('admin'), so reaching it at all
    // proves `authenticate` read role='admin' off the profiles row rather than
    // trusting anything in the token itself.
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('T-3b: schoolId is resolved from profiles, not from the request', async () => {
    // A teacher may list their own school's classes. That route compares
    // req.user.schoolId to the URL, so a 200 here means schoolId was populated
    // from the profiles row.
    const res = await request(app)
      .get(`/api/v1/schools/${schoolA}/classes`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // T-4
  // -------------------------------------------------------------------------

  it('T-4: roleGuard returns 403, not 401, for the wrong role', async () => {
    // A parent is authenticated but not permitted. The distinction matters:
    // lib/api.ts signs the user out on 401, so returning 401 here would log
    // out anyone who touched a route meant for another role.
    const res = await request(app)
      .get('/api/v1/photos?classId=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${parent.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('T-4b: a teacher cannot reach a parent-only route', async () => {
    const res = await request(app)
      .get('/api/v1/feed')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  // -------------------------------------------------------------------------
  // T-5
  // -------------------------------------------------------------------------

  it('T-5: a parent hitting /admin/* gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${parent.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('T-5b: a teacher hitting /admin/* gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(403);
  });

  it('T-5c: an unauthenticated request to /admin/* gets 401, not 403', async () => {
    // Order matters: authenticate runs before roleGuard, so an anonymous
    // caller must not be told that the route needs the admin role.
    const res = await request(app).get('/api/v1/admin/dashboard');

    expect(res.status).toBe(401);
  });
});
