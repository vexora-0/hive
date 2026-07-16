import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

import app from '../src/app';
import { AppError, errorHandler } from '../src/middleware/errorHandler';
import {
  createSchoolSchema,
  updateUserRoleSchema,
  getUsersSchema,
  createStudentSchema,
  mapParentSchema,
} from '../src/validators/admin.validator';
import {
  requestUploadSchema,
  tagStudentsBodySchema,
  getPhotosSchema,
} from '../src/validators/photo.validator';
import { createTestUser, cleanupUsers, type TestUser } from './helpers';

// ---------------------------------------------------------------------------
// T-26 — every Zod schema rejects representative malformed input
// ---------------------------------------------------------------------------

describe('T-26: validation schemas reject malformed input', () => {
  const cases: Array<{ name: string; schema: { safeParse: (v: unknown) => { success: boolean } }; bad: unknown }> = [
    { name: 'createSchoolSchema — missing name', schema: createSchoolSchema, bad: {} },
    { name: 'createSchoolSchema — name too long', schema: createSchoolSchema, bad: { name: 'x'.repeat(201) } },
    { name: 'createSchoolSchema — bad phone', schema: createSchoolSchema, bad: { name: 'A', phone: 'not a phone' } },
    { name: 'createSchoolSchema — bad logo URL', schema: createSchoolSchema, bad: { name: 'A', logoUrl: 'nope' } },
    { name: 'updateUserRoleSchema — unknown role', schema: updateUserRoleSchema, bad: { role: 'superuser' } },
    { name: 'updateUserRoleSchema — removed role', schema: updateUserRoleSchema, bad: { role: 'school_admin' } },
    { name: 'getUsersSchema — search too long', schema: getUsersSchema, bad: { search: 'x'.repeat(101) } },
    { name: 'getUsersSchema — limit over max', schema: getUsersSchema, bad: { limit: 999 } },
    { name: 'createStudentSchema — non-UUID schoolId', schema: createStudentSchema, bad: { fullName: 'A', schoolId: 'abc' } },
    { name: 'mapParentSchema — invalid email', schema: mapParentSchema, bad: { email: 'not-an-email' } },
    { name: 'requestUploadSchema — non-UUID classId', schema: requestUploadSchema, bad: { classId: 'abc', filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 1 } },
    { name: 'requestUploadSchema — disallowed contentType', schema: requestUploadSchema, bad: { classId: '00000000-0000-0000-0000-000000000000', filename: 'a.gif', contentType: 'image/gif', fileSize: 1 } },
    { name: 'requestUploadSchema — file over 25MB', schema: requestUploadSchema, bad: { classId: '00000000-0000-0000-0000-000000000000', filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 26 * 1024 * 1024 } },
    { name: 'requestUploadSchema — malformed sha256', schema: requestUploadSchema, bad: { classId: '00000000-0000-0000-0000-000000000000', filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 1, sha256Hash: 'xyz' } },
    { name: 'tagStudentsBodySchema — empty studentIds', schema: tagStudentsBodySchema, bad: { studentIds: [] } },
    { name: 'tagStudentsBodySchema — non-UUID studentId', schema: tagStudentsBodySchema, bad: { studentIds: ['abc'] } },
    { name: 'tagStudentsBodySchema — over the 50-student cap', schema: tagStudentsBodySchema, bad: { studentIds: Array.from({ length: 51 }, () => '11111111-1111-4111-8111-111111111111') } },
    { name: 'getPhotosSchema — non-UUID classId', schema: getPhotosSchema, bad: { classId: 'abc' } },
  ];

  for (const { name, schema, bad } of cases) {
    it(name, () => {
      expect(schema.safeParse(bad).success).toBe(false);
    });
  }

  it('accepts well-formed input, so the cases above fail for the right reason', () => {
    expect(createSchoolSchema.safeParse({ name: 'Sunrise Preschool' }).success).toBe(true);
    expect(updateUserRoleSchema.safeParse({ role: 'teacher' }).success).toBe(true);
    expect(
      requestUploadSchema.safeParse({
        classId: '11111111-1111-4111-8111-111111111111',
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024,
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-33 — AppError maps to the right status and code
// ---------------------------------------------------------------------------

describe('T-33: AppError maps to its status and code', () => {
  /** Mount errorHandler behind a route that throws whatever we hand it. */
  function appThrowing(err: Error) {
    const a = express();
    a.get('/boom', (_req, _res, next) => next(err));
    a.use(errorHandler);
    return a;
  }

  it('renders statusCode and code from the error', async () => {
    const res = await request(
      appThrowing(new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND')),
    ).get('/boom');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Photo not found',
      code: 'PHOTO_NOT_FOUND',
    });
  });

  it('renders a 403 FORBIDDEN unchanged', async () => {
    const res = await request(
      appThrowing(new AppError('You do not have access to this school', 403, 'FORBIDDEN')),
    ).get('/boom');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('defaults to 500 INTERNAL_ERROR', async () => {
    const res = await request(appThrowing(new AppError('Something broke'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('survives instanceof across the prototype fix', () => {
    // AppError calls Object.setPrototypeOf in its constructor. Without it,
    // `err instanceof AppError` is false under ES5-targeted downlevelling and
    // every AppError would fall through to the 500 branch.
    const err = new AppError('x', 418, 'TEAPOT');
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-34 — production does not leak err.message for unknown errors
// ---------------------------------------------------------------------------

describe('T-34: unknown errors do not leak their message in production', () => {
  function appThrowing(err: Error) {
    const a = express();
    a.get('/boom', (_req, _res, next) => next(err));
    a.use(errorHandler);
    return a;
  }

  const SECRET = 'connection to postgres://user:hunter2@db.internal failed';

  it('leaks nothing when NODE_ENV=production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(appThrowing(new Error(SECRET))).get('/boom');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(JSON.stringify(res.body)).not.toContain('postgres://');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('does surface the message outside production, for local debugging', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const res = await request(appThrowing(new Error(SECRET))).get('/boom');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(SECRET);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('never returns a stack trace in the response body', async () => {
    const res = await request(appThrowing(new Error('boom'))).get('/boom');

    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toContain('at Object');
  });
});

// ---------------------------------------------------------------------------
// Envelope consistency over the real app
// ---------------------------------------------------------------------------

describe('error envelope over the mounted app', () => {
  let parent: TestUser;

  beforeAll(async () => {
    parent = await createTestUser('parent', null);
  });

  afterAll(async () => {
    await cleanupUsers();
  });

  it('an unmatched route returns the standard 404 envelope', async () => {
    const res = await request(app).get('/api/v1/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('a Zod failure at the route boundary returns VALIDATION_ERROR with field paths', async () => {
    // classId must be a UUID; getPhotosSchema rejects it before the controller.
    // roleGuard runs first, so this needs a role permitted on the route.
    const teacher = await createTestUser('teacher', null);

    const res = await request(app)
      .get('/api/v1/photos?classId=not-a-uuid')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0]).toHaveProperty('field');
  });

  it('every error response carries success:false, message and code', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${parent.token}`);

    expect(res.body).toHaveProperty('success', false);
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.code).toBe('string');
  });
});
