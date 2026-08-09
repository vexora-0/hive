import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { getFeedSchema } from '../validators/feed.validator';
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

// GET /feed/photos/:id - Get single photo details
router.get(
  '/photos/:id',
  roleGuard('parent'),
  validate(uuidIdParam, 'params'),
  feedController.getPhotoDetails,
);

export default router;
