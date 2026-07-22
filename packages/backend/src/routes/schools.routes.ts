import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { createClassSchema } from '../validators/school.validator';
import * as schoolController from '../controllers/school.controller';

const router: import("express").Router = Router();

// All school routes require authentication.
router.use(authenticate);

// GET /schools/:id/classes - list classes for a school
router.get('/:id/classes', roleGuard('teacher', 'admin'), schoolController.listClasses);

// GET /schools/:id/students - list students for a school
router.get('/:id/students', roleGuard('teacher', 'admin'), schoolController.listStudents);

// POST /schools/:id/classes - create a class (admin only)
router.post(
  '/:id/classes',
  roleGuard('admin'),
  validate(createClassSchema, 'body'),
  schoolController.createClass,
);

export default router;
