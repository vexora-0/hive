import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  requestUploadSchema,
  getPhotosSchema,
} from '../validators/photo.validator';
import * as photoController from '../controllers/photo.controller';
import { photoUpload } from '../middleware/upload';

const router: import("express").Router = Router();

// All photo routes require authentication
router.use(authenticate);

// POST /photos/upload-url - Request presigned upload URL (teacher only)
router.post(
  '/upload-url',
  roleGuard('teacher', 'school_admin'),
  validate(requestUploadSchema, 'body'),
  photoController.requestUpload,
);

// POST /photos/:id/file - Upload photo file to local storage (teacher only)
router.post(
  '/:id/file',
  roleGuard('teacher', 'school_admin'),
  photoUpload.single('file'),
  photoController.uploadFile,
);

// POST /photos/:id/confirm - Confirm upload complete (teacher only)
router.post(
  '/:id/confirm',
  roleGuard('teacher', 'school_admin'),
  photoController.confirmUpload,
);

// POST /photos/:id/tag - Tag students in a photo (teacher only)
router.post(
  '/:id/tag',
  roleGuard('teacher', 'school_admin'),
  photoController.tagStudents,
);

// GET /photos - Get photos for a class (teacher only)
router.get(
  '/',
  roleGuard('teacher', 'school_admin'),
  validate(getPhotosSchema, 'query'),
  photoController.getPhotos,
);

export default router;
