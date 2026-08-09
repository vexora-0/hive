import { z } from 'zod';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const requestUploadSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID'),
  filename: z
    .string()
    .min(1, 'filename is required')
    .max(255, 'filename too long'),
  contentType: z.enum(
    ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'],
    {
      errorMap: () => ({
        message:
          'contentType must be one of: image/jpeg, image/png, image/heic, image/heif, image/webp',
      }),
    },
  ),
  // Optional, and advisory when present.
  //
  // The picker does not always supply a size — `fileSize` is optional on
  // ImagePickerAsset, and Android ContentProviders frequently omit it — so the
  // client sent 0 and every photo failed here with "fileSize must be positive"
  // before a single byte was transferred. Requiring it bought nothing either:
  // this is a client-declared number that is never checked against the actual
  // upload, and the real 25MB ceiling is enforced by multer on the bytes.
  fileSize: z
    .number()
    .int()
    .positive('fileSize must be positive')
    .max(MAX_FILE_SIZE, `fileSize must not exceed ${MAX_FILE_SIZE} bytes (25MB)`)
    .optional(),
  sha256Hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'sha256Hash must be a valid SHA-256 hex string')
    .optional(),
});

/**
 * Body of POST /photos/:id/tag.
 *
 * The photo ID comes from the URL, so it is deliberately absent here — the
 * previous schema required it in the body, which is why it could never be
 * wired to the route and the endpoint ran with no validation at all.
 *
 * The 50-item cap bounds the `.in()` filter the service builds from this list.
 */
export const tagStudentsBodySchema = z.object({
  studentIds: z
    .array(z.string().uuid('Each studentId must be a valid UUID'))
    .min(1, 'At least one studentId is required')
    .max(50, 'Cannot tag more than 50 students in one photo'),
});

export const getPhotosSchema = z.object({
  classId: z.string().uuid('classId must be a valid UUID').optional(),
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must not exceed 50')
    .default(20),
});

export type RequestUploadInput = z.infer<typeof requestUploadSchema>;
export type TagStudentsInput = z.infer<typeof tagStudentsBodySchema>;
export type GetPhotosInput = z.infer<typeof getPhotosSchema>;
