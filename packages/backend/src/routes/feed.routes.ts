import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  getFeedSchema,
  getDiarySchema,
  getDiaryChapterQuery,
  diaryMonthParam,
} from '../validators/feed.validator';
import { uuidIdParam } from '../validators/params.validator';
import * as feedController from '../controllers/feed.controller';

const router: import("express").Router = Router();

// All feed routes require authentication
router.use(authenticate);

// GET /feed - Get parent photo feed
router.get(
  '/',
  roleGuard('parent'),
  validate(getFeedSchema, 'query'),
  feedController.getFeed,
);

// GET /feed/diary - Outline of one child's whole journey
//
// Registered before /photos/:id only for readability; the two paths cannot
// collide. Both diary routes are parent-only and check that the child belongs
// to the caller inside the service.
router.get(
  '/diary',
  roleGuard('parent'),
  validate(getDiarySchema, 'query'),
  feedController.getDiary,
);

// GET /feed/diary/:month - One month of the diary, grouped into days
router.get(
  '/diary/:month',
  roleGuard('parent'),
  validate(diaryMonthParam, 'params'),
  validate(getDiaryChapterQuery, 'query'),
  feedController.getDiaryChapter,
);

// GET /feed/photos/:id - Get single photo details
router.get(
  '/photos/:id',
  roleGuard('parent'),
  validate(uuidIdParam, 'params'),
  feedController.getPhotoDetails,
);

export default router;
