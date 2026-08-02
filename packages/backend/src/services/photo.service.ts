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
export async function saveUploadedFile(
  photoId: string,
  tempFilePath: string,
  user: { id: string; role: string; schoolId: string | null },
): Promise<void> {
  try {
    const photo = await assertPhotoAccess(photoId, user);

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
  user: { id: string; role: string; schoolId: string | null },
): Promise<void> {
  const photo = await assertPhotoAccess(photoId, user);

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
  user: { id: string; role: string; schoolId: string | null },
): Promise<void> {
  // 1. Load the photo and verify ownership, using the same guard as /file and
  //    /confirm. This supersedes the separate profile/school lookup that used
  //    to live here — ownership already implies the caller is at the photo's
  //    school, and the old check did not verify the uploader at all.
  const photo = await assertPhotoAccess(photoId, user);

  // 3. Verify all students belong to the same school
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

  // 4. Insert photo_student_tags (upsert to avoid duplicates)
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

/**
 * Soft-delete a photo by moving it to 'archived'.
 *
 * Deliberately not a hard delete. `order_items.photo_id` is ON DELETE RESTRICT
 * (migration 00018), so removing a photo somebody has ordered would fail at the
 * database; and dropping the storage objects would blank out the thumbnails in
 * that parent's order history. 'archived' has been in the photos CHECK
 * constraint since 00007 and was, until now, unreachable — this is the write it
 * was added for. (G-41)
 *
 * Nothing needs to change on the parent side: both queries in feed.service
 * filter `status = 'ready'`, so the photo leaves every parent's feed the moment
 * this returns.
 */
export async function archivePhoto(
  photoId: string,
  user: { id: string; role: string; schoolId: string | null },
): Promise<void> {
  const photo = await assertPhotoAccess(photoId, user);

  // 'processing' is excluded because an upload may still be in flight against
  // this row; saveUploadedFile would then fail on a photo the teacher thinks
  // they removed. 'archived' is excluded because it is already done.
  if (photo.status !== 'ready' && photo.status !== 'failed') {
    throw new AppError(
      `Cannot archive a photo in '${photo.status}' state`,
      400,
      'INVALID_STATE',
    );
  }

  const { error } = await supabaseAdmin
    .from('photos')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', photoId);

  if (error) {
    logger.error('Failed to archive photo', { error: error.message, photoId });
    throw new AppError('Failed to archive photo', 500, 'UPDATE_FAILED');
  }

  logger.info('Photo archived', { photoId, userId: user.id });
}

/**
 * Remove one student's tag from a photo.
 *
 * The tag is the only path from a parent to a photo, so this is the correction
 * for tagging the wrong child — it revokes that family's access without
 * touching anybody else's. RLS policy `pst_teacher_delete` (migration 00011)
 * was written for exactly this and had no caller.
 *
 * Guarded by `assertPhotoAccess`, the same rule as tagging: the uploader, at
 * their own school, or an admin.
 */
export async function untagStudent(
  photoId: string,
  studentId: string,
  user: { id: string; role: string; schoolId: string | null },
): Promise<void> {
  await assertPhotoAccess(photoId, user);

  const { error, count } = await supabaseAdmin
    .from('photo_student_tags')
    .delete({ count: 'exact' })
    .eq('photo_id', photoId)
    .eq('student_id', studentId);

  if (error) {
    logger.error('Failed to untag student', {
      error: error.message,
      photoId,
      studentId,
    });
    throw new AppError('Failed to untag student', 500, 'DELETE_FAILED');
  }

  if (count === 0) {
    throw new AppError('Tag not found', 404, 'NOT_FOUND');
  }

  logger.info('Student untagged', { photoId, studentId, userId: user.id });
}

/**
 * Verify the caller may act on this photo.
 *
 * Admins may act anywhere. A teacher must be **the uploader, and at the
 * photo's school**. The file and confirm endpoints previously checked nothing
 * but status, so any teacher could overwrite any other teacher's photo by
 * supplying its ID. (G-17)
 *
 * The school check alone is not enough. G-17 as written in the audit is
 * "Teacher A can overwrite the file content of any other teacher's photo — at
 * their own school, or, combined with G-08, any school." A school-scoped guard
 * closes only the cross-school half and leaves same-school overwrite open,
 * which is the more likely scenario in practice: colleagues share a school.
 *
 * Uploader scope is applied to tagging too, so one guard covers /file,
 * /confirm and /tag. Letting a colleague tag your photo is a defensible
 * product choice, but nothing in the app needs it, and one rule across three
 * routes is easier to keep correct than two that differ subtly.
 */
async function assertPhotoAccess(
  photoId: string,
  user: { id: string; role: string; schoolId: string | null },
): Promise<{ s3_key: string; status: string; mime_type: string; school_id: string }> {
  const { data: photo, error } = await supabaseAdmin
    .from('photos')
    .select('s3_key, status, mime_type, school_id, uploaded_by')
    .eq('id', photoId)
    .single();

  if (error || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  if (user.role === 'admin') {
    return photo;
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
    throw new AppError('You do not have access to this photo', 403, 'FORBIDDEN');
  }

  return photo;
}

export async function getPhotosByClass(
  classId: string,
  cursor: string | undefined,
  limit: number,
  user: { role: string; schoolId: string | null },
): Promise<PaginatedPhotos> {
  // Scope to the caller's school — previously any teacher could list any
  // class's photos by ID. (G-08)
  const { data: cls, error: clsError } = await supabaseAdmin
    .from('classes')
    .select('school_id')
    .eq('id', classId)
    .single();

  if (clsError || !cls) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }
  if (user.role !== 'admin' && cls.school_id !== user.schoolId) {
    throw new AppError('You do not have access to this class', 403, 'FORBIDDEN');
  }

  let query = supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id')
    .eq('class_id', classId)
    // Archived photos are removed from the teacher's grid. The parent feed
    // needs no equivalent — it already filters `status = 'ready'`.
    .neq('status', 'archived')
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
