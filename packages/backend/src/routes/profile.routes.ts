import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../validators/profile.validator';
import * as profileController from '../controllers/profile.controller';

const router: import("express").Router = Router();

// Every role has a profile, so there is no roleGuard here — the scope is the
// caller's own row, which `authenticate` has already established.
router.use(authenticate);

// GET /me - The caller's own profile
router.get('/', profileController.getMe);

// PATCH /me - Update name and phone. Role and school are admin-only.
router.patch(
  '/',
  validate(updateProfileSchema, 'body'),
  profileController.updateMe,
);

export default router;
