import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import * as feedController from '../controllers/feed.controller';

const router: import("express").Router = Router();

// All feed routes require authentication
router.use(authenticate);

// GET /feed - Get parent photo feed
router.get(
  '/',
  roleGuard('parent'),
  feedController.getFeed,
);

// GET /feed/photos/:id - Get single photo details
router.get(
  '/photos/:id',
  roleGuard('parent'),
  feedController.getPhotoDetails,
);

export default router;
