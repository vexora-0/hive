import path from 'path';
import fs from 'fs';
import multer from 'multer';

import { AppError } from './errorHandler';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'photos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Temp filename — the controller will rename to the correct s3_key path
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `tmp_${Date.now()}${ext}`);
  },
});

export const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // A plain Error here reaches errorHandler with neither a status nor a
      // code and is reported as a 500. An AppError carries both, so the client
      // gets the 400 this actually is, with a message naming the bad type.
      cb(
        new AppError(
          `Unsupported file type: ${file.mimetype}. Allowed: ${allowed.join(', ')}`,
          400,
          'UNSUPPORTED_FILE_TYPE',
        ),
      );
    }
  },
});
