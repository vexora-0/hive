import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  requestUploadSchema,
  getPhotosSchema,
  tagStudentsBodySchema,
} from '../validators/photo.validator';
import {
  uuidIdParam,
  uuidPhotoAndStudentParams,
} from '../validators/params.validator';
import * as photoController from '../controllers/photo.controller';
import { photoUpload } from '../middleware/upload';

const router: import("express").Router = Router();

// All photo routes require authentication
router.use(authenticate);

// POST /photos/upload-url - Request presigned upload URL (teacher only)
router.post(
  '/upload-url',
  roleGuard('teacher', 'admin'),
  validate(requestUploadSchema, 'body'),
  photoController.requestUpload,
);

// POST /photos/:id/file - Upload photo file to local storage (teacher only)
router.post(
  '/:id/file',
  roleGuard('teacher', 'admin'),
  photoUpload.single('file'),
  photoController.uploadFile,
);

// POST /photos/:id/confirm - Confirm upload complete (teacher only)
router.post(
  '/:id/confirm',
  roleGuard('teacher', 'admin'),
  photoController.confirmUpload,
);

// POST /photos/:id/tag - Tag students in a photo (teacher only)
router.post(
  '/:id/tag',
  roleGuard('teacher', 'admin'),
  validate(tagStudentsBodySchema, 'body'),
  photoController.tagStudents,
);

// DELETE /photos/:id - Archive a photo (uploader or admin)
router.delete(
  '/:id',
  roleGuard('teacher', 'admin'),
  validate(uuidIdParam, 'params'),
  photoController.archivePhoto,
);

// DELETE /photos/:id/tag/:studentId - Remove one student's tag (uploader or admin)
router.delete(
  '/:id/tag/:studentId',
  roleGuard('teacher', 'admin'),
  validate(uuidPhotoAndStudentParams, 'params'),
  photoController.untagStudent,
);

// GET /photos - Get photos for a class (teacher only)
router.get(
  '/',
  roleGuard('teacher', 'admin'),
  validate(getPhotosSchema, 'query'),
  photoController.getPhotos,
);

export default router;
