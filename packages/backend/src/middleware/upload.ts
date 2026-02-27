import path from 'path';
import fs from 'fs';
import multer from 'multer';

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
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});
