import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uuidIdParam } from '../validators/params.validator';
import { markAllReadBody } from '../validators/notification.validator';
import * as notificationController from '../controllers/notification.controller';

const router: import("express").Router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications - Get user notifications
router.get('/', notificationController.getNotifications);

// GET /notifications/unread-count - Get unread count
// NOTE: This route must be defined BEFORE /:id/read to avoid route conflicts
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /notifications/read-all - Mark every unread notification as read
// Sits with the other literal path above /:id/read for readability; the two
// cannot collide, since /:id/read is a two-segment pattern.
router.patch(
  '/read-all',
  validate(markAllReadBody, 'body'),
  notificationController.markAllAsRead,
);

// PATCH /notifications/:id/read - Mark notification as read
// Params validated: this route carries no roleGuard, so without it any
// authenticated user could send a non-UUID id and get a 500 from the driver.
router.patch(
  '/:id/read',
  validate(uuidIdParam, 'params'),
  notificationController.markAsRead,
);

export default router;
