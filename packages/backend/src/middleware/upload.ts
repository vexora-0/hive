import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
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
    // Temp filename — the controller will rename to the correct s3_key path.
    //
    // A UUID, not a timestamp. `Date.now()` has millisecond resolution and no
    // per-request entropy, and the client uploads three photos concurrently, so
    // two requests entering the file part in the same millisecond produced the
    // same path. diskStorage truncates on open, so one request's bytes replaced
    // the other's, and the loser's `finally` unlink deleted the file the winner
    // was still reading. The visible outcomes were a spurious "not a readable
    // image" — and, worse, a photo stored against the wrong photo row, which in
    // this application means one child's picture filed under another child's
    // class.
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `tmp_${randomUUID()}${ext}`);
  },
});

export const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    // Kept in step with `requestUploadSchema.contentType`. The magic-byte check
    // in the image processor is the real gate; this only rejects the obviously
    // wrong before 25MB is written to disk.
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp',
    ];
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
