import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as notificationController from '../controllers/notification.controller';

const router: import("express").Router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications - Get user notifications
router.get('/', notificationController.getNotifications);

// GET /notifications/unread-count - Get unread count
// NOTE: This route must be defined BEFORE /:id/read to avoid route conflicts
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /notifications/:id/read - Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

export default router;
