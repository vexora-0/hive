import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { createClassSchema } from '../validators/school.validator';
import { uuidIdParam } from '../validators/params.validator';
import * as schoolController from '../controllers/school.controller';

const router: import("express").Router = Router();

// All school routes require authentication.
router.use(authenticate);

// The school id reaches Postgres directly, so a non-UUID came back as a driver
// error and a 500. Validated before the handler runs.

// GET /schools/:id/classes - list classes for a school
router.get(
  '/:id/classes',
  roleGuard('teacher', 'admin'),
  validate(uuidIdParam, 'params'),
  schoolController.listClasses,
);

// GET /schools/:id/students - list students for a school
router.get(
  '/:id/students',
  roleGuard('teacher', 'admin'),
  validate(uuidIdParam, 'params'),
  schoolController.listStudents,
);

// POST /schools/:id/classes - create a class (admin only)
router.post(
  '/:id/classes',
  roleGuard('admin'),
  validate(uuidIdParam, 'params'),
  validate(createClassSchema, 'body'),
  schoolController.createClass,
);

export default router;
