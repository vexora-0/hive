import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { processAndUploadPhoto } from '../utils/imageProcessor';
import {
  getSignedPhotoUrls,
  fileExistsInStorage,
  deletePhotoObjects,
} from '../utils/supabaseStorage';
import type { AuthUser } from '../middleware/auth';
import type { RequestUploadInput } from '../validators/photo.validator';

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

interface UploadResult {
  photoId: string;
  s3Key: string;
}

interface PhotoWithUrl {
  id: string;
  s3_key: string;
  thumbnail_s3_key: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  status: string;
  created_at: string;
  uploaded_by: string;
  class_id: string;
  url: string;
  thumbnailUrl: string | null;
}

interface PaginatedPhotos {
  photos: PhotoWithUrl[];
  nextCursor: string | null;
}

export async function requestUpload(
  userId: string,
  data: RequestUploadInput,
): Promise<UploadResult> {
  // 1. Look up the user's school
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.school_id) {
    throw new AppError('User school not found', 404, 'SCHOOL_NOT_FOUND');
  }

  const schoolId = profile.school_id;

  // 2. Verify teacher belongs to the class's school
  const { data: classRecord, error: classError } = await supabaseAdmin
    .from('classes')
    .select('school_id')
    .eq('id', data.classId)
    .single();

  if (classError || !classRecord) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  if (classRecord.school_id !== schoolId) {
    throw new AppError(
      'You do not have permission to upload to this class',
      403,
      'FORBIDDEN',
    );
  }

  // 4. Generate storage path (Supabase Storage)
  const ext = CONTENT_TYPE_TO_EXT[data.contentType] ?? 'jpg';
  const photoId = uuidv4();
  const storagePath = `photos/${schoolId}/${data.classId}/${photoId}.${ext}`;

  // 5. Create photo record (app will upload file to Supabase Storage)
  const { error: insertError } = await supabaseAdmin.from('photos').insert({
    id: photoId,
    s3_key: storagePath,
    class_id: data.classId,
    school_id: schoolId,
    uploaded_by: userId,
    status: 'processing',
    original_filename: data.filename,
    mime_type: data.contentType,
    file_size_bytes: data.fileSize,
    ...(data.sha256Hash ? { sha256_hash: data.sha256Hash } : {}),
  });

  if (insertError) {
    logger.error('Failed to create photo record', {
      error: insertError.message,
      photoId,
    });
    throw new AppError('Failed to create photo record', 500, 'INSERT_FAILED');
  }

  logger.info('Photo record created', { photoId, storagePath, userId });

  return { photoId, s3Key: storagePath };
}

/**
 * Receive the uploaded file, process it and store it.
 *
 * The photo stays in 'processing' after this returns. It only becomes 'ready'
 * in confirmUpload(), which the client calls *after* tagging — the
 * notify_parents_on_photo trigger fires on the transition to 'ready' and loops
 * over photo_student_tags, so tags must already exist or no parent is ever
 * notified. See G-07.
 */
interface PhotoOwnershipRow {
  s3_key: string;
  status: string;
  /** NOT NULL DEFAULT 'image/jpeg' — see migration 00007. */
  mime_type: string;
  school_id: string;
  uploaded_by: string;
}

/**
 * Load a photo and assert that `user` is entitled to mutate it.
 *
 * Every route below takes a photo ID straight from the URL. Without this,
 * checking only `status` — as all three of them did — lets any teacher
 * overwrite, confirm or tag any other teacher's photo.
 *
 * - `admin` may act on any photo.
 * - `teacher` must be the uploader **and** at the photo's school.
 * - anything else is refused.
 *
 * Tagging is held to the same uploader rule as upload and confirm rather than
 * the looser school rule it used before. A colleague at the same school tagging
 * someone else's photo is a plausible product decision, but it is not one this
 * codebase needs, and a single guard across all three routes is easier to
 * reason about than two similar ones that differ in a way nobody remembers.
 */
async function assertPhotoOwnership(
  photoId: string,
  user: AuthUser,
): Promise<PhotoOwnershipRow> {
  const { data: photo, error } = await supabaseAdmin
    .from('photos')
    .select('s3_key, status, mime_type, school_id, uploaded_by')
    .eq('id', photoId)
    .single();

  if (error || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  if (user.role === 'admin') {
    return photo as PhotoOwnershipRow;
  }

  const isOwner =
    user.role === 'teacher' &&
    photo.uploaded_by === user.id &&
    photo.school_id === user.schoolId;

  if (!isOwner) {
    logger.warn('Blocked photo mutation', {
      photoId,
      userId: user.id,
      role: user.role,
    });
    throw new AppError(
      'You do not have permission to modify this photo',
      403,
      'FORBIDDEN',
    );
  }

  return photo as PhotoOwnershipRow;
}

export async function saveUploadedFile(
  photoId: string,
  tempFilePath: string,
  user: AuthUser,
): Promise<void> {
  try {
    const photo = await assertPhotoOwnership(photoId, user);

    if (photo.status !== 'processing') {
      throw new AppError(
        `Photo is already in '${photo.status}' state`,
        400,
        'INVALID_STATE',
      );
    }

    const buffer = fs.readFileSync(tempFilePath);

    // Validates magic bytes, converts HEIC, uploads original + thumbnail,
    // and computes the blurhash. Throws on anything that isn't a real image.
    let processed;
    try {
      processed = await processAndUploadPhoto(buffer, photo.s3_key, photo.mime_type);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image processing failed';
      throw new AppError(message, 400, 'INVALID_IMAGE');
    }

    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update({
        s3_key: processed.storagePath,
        thumbnail_s3_key: processed.thumbnailPath,
        mime_type: processed.mimeType,
        width: processed.width,
        height: processed.height,
        blurhash: processed.blurhash,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', photoId);

    if (updateError) {
      // The objects are already in storage; drop them so a retry starts clean.
      await deletePhotoObjects([processed.storagePath, processed.thumbnailPath]);
      logger.error('Failed to record processed photo', {
        error: updateError.message,
        photoId,
      });
      throw new AppError('Failed to save photo', 500, 'UPDATE_FAILED');
    }

    logger.info('Photo uploaded and processed', {
      photoId,
      storagePath: processed.storagePath,
    });
  } finally {
    // Always remove the multer temp file, on success or failure.
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // Already gone — nothing to do.
    }
  }
}

/**
 * Mark a photo ready and make it visible to parents.
 *
 * Called after tagging. This is the write that fires both database triggers:
 * notify_parents_on_photo and notify_teacher_on_upload_complete.
 */
export async function confirmUpload(
  photoId: string,
  user: AuthUser,
): Promise<void> {
  const photo = await assertPhotoOwnership(photoId, user);

  if (photo.status !== 'processing') {
    throw new AppError(
      `Photo is already in '${photo.status}' state`,
      400,
      'INVALID_STATE',
    );
  }

  const exists = await fileExistsInStorage(photo.s3_key);
  if (!exists) {
    throw new AppError(
      'Photo file not found in storage. Please upload the file first.',
      404,
      'FILE_NOT_FOUND',
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('photos')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', photoId);

  if (updateError) {
    logger.error('Failed to confirm photo', { error: updateError.message, photoId });
    throw new AppError('Failed to confirm upload', 500, 'UPDATE_FAILED');
  }

  logger.info('Upload confirmed, photo is now visible to tagged parents', { photoId });
}

export async function tagStudents(
  photoId: string,
  studentIds: string[],
  user: AuthUser,
): Promise<void> {
  // 1. Load the photo and verify ownership. This supersedes the separate
  //    profile/school lookup that used to live here: ownership already implies
  //    the caller is at the photo's school.
  const photo = await assertPhotoOwnership(photoId, user);

  // 2. Verify all students belong to the same school
  const { data: students, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id')
    .in('id', studentIds)
    .eq('school_id', photo.school_id);

  if (studentsError) {
    throw new AppError('Failed to verify students', 500, 'QUERY_FAILED');
  }

  const validStudentIds = new Set(students?.map((s) => s.id) ?? []);
  const invalidIds = studentIds.filter((id) => !validStudentIds.has(id));

  if (invalidIds.length > 0) {
    throw new AppError(
      `Students not found at this school: ${invalidIds.join(', ')}`,
      400,
      'INVALID_STUDENTS',
    );
  }

  // 3. Insert photo_student_tags (upsert to avoid duplicates)
  const tags = studentIds.map((studentId) => ({
    photo_id: photoId,
    student_id: studentId,
    tagged_by: user.id,
  }));

  const { error: tagError } = await supabaseAdmin
    .from('photo_student_tags')
    .upsert(tags, {
      onConflict: 'photo_id,student_id',
      ignoreDuplicates: true,
    });

  if (tagError) {
    logger.error('Failed to tag students', {
      error: tagError.message,
      photoId,
    });
    throw new AppError('Failed to tag students', 500, 'TAG_FAILED');
  }

  logger.info('Students tagged', {
    photoId,
    studentCount: studentIds.length,
    userId: user.id,
  });
}

export async function getPhotosByClass(
  classId: string,
  user: AuthUser,
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedPhotos> {
  // The class ID arrives from the query string, so confirm it belongs to the
  // caller's school before listing anything. Same shape as the check
  // requestUpload already performs. Takes the whole AuthUser rather than a
  // school ID because platform admins have school_id = null and must still be
  // able to read any class.
  if (user.role !== 'admin') {
    const { data: classRecord, error: classError } = await supabaseAdmin
      .from('classes')
      .select('school_id')
      .eq('id', classId)
      .single();

    if (classError || !classRecord) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    if (classRecord.school_id !== user.schoolId) {
      logger.warn('Blocked cross-school photo listing', {
        classId,
        userId: user.id,
      });
      throw new AppError(
        'You do not have permission to view photos for this class',
        403,
        'FORBIDDEN',
      );
    }
  }

  let query = supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  // Cursor-based pagination using (created_at, id)
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: photos, error } = await query;

  if (error) {
    logger.error('Failed to fetch photos', { error: error.message, classId });
    throw new AppError('Failed to fetch photos', 500, 'QUERY_FAILED');
  }

  const hasNext = (photos?.length ?? 0) > limit;
  const results = photos?.slice(0, limit) ?? [];

  // The bucket is private, so every URL is signed. One batch call rather than
  // two per photo.
  const signed = await getSignedPhotoUrls(
    results.flatMap((p) => [p.s3_key, p.thumbnail_s3_key].filter(Boolean) as string[]),
  );

  const photosWithUrls: PhotoWithUrl[] = results.map((photo) => ({
    ...photo,
    url: signed.get(photo.s3_key) ?? '',
    thumbnailUrl: photo.thumbnail_s3_key
      ? (signed.get(photo.thumbnail_s3_key) ?? null)
      : null,
  }));

  const nextCursor = hasNext && results.length > 0
    ? Buffer.from(
        JSON.stringify({
          createdAt: results[results.length - 1].created_at,
          id: results[results.length - 1].id,
        }),
      ).toString('base64url')
    : null;

  return { photos: photosWithUrls, nextCursor };
}
