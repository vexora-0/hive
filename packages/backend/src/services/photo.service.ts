import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';
import type { AuthUser } from '../middleware/auth';
import type { RequestUploadInput } from '../validators/photo.validator';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

interface UploadResult {
  photoId: string;
  uploadUrl: string;
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

  logger.info('Upload requested (Supabase Storage)', { photoId, storagePath, userId });

  return { photoId, uploadUrl: '', s3Key: storagePath };
}

export async function saveUploadedFile(
  photoId: string,
  tempFilePath: string,
): Promise<void> {
  // 1. Get photo record
  const { data: photo, error: photoError } = await supabaseAdmin
    .from('photos')
    .select('s3_key, status')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    fs.unlinkSync(tempFilePath);
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  if (photo.status !== 'processing') {
    fs.unlinkSync(tempFilePath);
    throw new AppError(
      `Photo is already in '${photo.status}' state`,
      400,
      'INVALID_STATE',
    );
  }

  // 2. Move temp file to final path based on s3_key
  const finalPath = path.join(UPLOADS_DIR, photo.s3_key);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.renameSync(tempFilePath, finalPath);

  // 3. Mark as ready
  const { error: updateError } = await supabaseAdmin
    .from('photos')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', photoId);

  if (updateError) {
    logger.error('Failed to confirm photo', { error: updateError.message, photoId });
    throw new AppError('Failed to confirm upload', 500, 'UPDATE_FAILED');
  }

  logger.info('Photo file saved locally', { photoId, path: photo.s3_key });
}

export async function confirmUpload(photoId: string): Promise<void> {
  // 1. Get photo record
  const { data: photo, error: photoError } = await supabaseAdmin
    .from('photos')
    .select('s3_key, status')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  if (photo.status !== 'processing') {
    throw new AppError(
      `Photo is already in '${photo.status}' state`,
      400,
      'INVALID_STATE',
    );
  }

  // 2. Verify photo exists locally
  const localPath = path.join(UPLOADS_DIR, photo.s3_key);
  if (!fs.existsSync(localPath)) {
    throw new AppError(
      'Photo file not found in storage. Please upload the file first.',
      404,
      'FILE_NOT_FOUND',
    );
  }

  // 3. Mark as ready (no server-side thumbnail for now; thumbnail_s3_key stays null)
  const { error: updateError } = await supabaseAdmin
    .from('photos')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', photoId);

  if (updateError) {
    logger.error('Failed to confirm photo', { error: updateError.message, photoId });
    throw new AppError('Failed to confirm upload', 500, 'UPDATE_FAILED');
  }

  logger.info('Upload confirmed (Supabase Storage)', { photoId });
}

export async function tagStudents(
  userId: string,
  photoId: string,
  studentIds: string[],
): Promise<void> {
  // 1. Verify photo exists
  const { data: photo, error: photoError } = await supabaseAdmin
    .from('photos')
    .select('school_id')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  // 2. Verify user (teacher) is at the same school
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .single();

  if (!profile || profile.school_id !== photo.school_id) {
    throw new AppError(
      'You can only tag students in photos from your school',
      403,
      'FORBIDDEN',
    );
  }

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
    tagged_by: userId,
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
    userId,
  });
}

export async function getPhotosByClass(
  classId: string,
  user: AuthUser,
  cursor?: string,
  limit: number = 20,
  baseUrl?: string,
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

  // Build URLs using the request origin so they work via ngrok/tunnel
  const origin = baseUrl ?? env.BACKEND_URL;
  const photosWithUrls: PhotoWithUrl[] = results.map((photo) => {
    const url = `${origin}/uploads/${photo.s3_key}`;
    const thumbnailUrl = photo.thumbnail_s3_key
      ? `${origin}/uploads/${photo.thumbnail_s3_key}`
      : null;
    return { ...photo, url, thumbnailUrl };
  });

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

export async function getParentFeed(
  parentId: string,
  childId?: string,
  cursor?: string,
  limit: number = 20,
  baseUrl?: string,
): Promise<PaginatedPhotos> {
  // 1. Get parent's student IDs
  let studentQuery = supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', parentId);

  if (childId) {
    studentQuery = studentQuery.eq('student_id', childId);
  }

  const { data: links, error: linksError } = await studentQuery;

  if (linksError) {
    throw new AppError('Failed to fetch student links', 500, 'QUERY_FAILED');
  }

  const studentIds = links?.map((l) => l.student_id) ?? [];

  if (studentIds.length === 0) {
    return { photos: [], nextCursor: null };
  }

  // 2. Query photos tagged with those students
  let query = supabaseAdmin
    .from('photo_student_tags')
    .select(
      'photo_id, photos!inner(id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id)',
    )
    .in('student_id', studentIds)
    .eq('photos.status', 'ready')
    .order('photos(created_at)', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `photos.created_at.lt.${decoded.createdAt},and(photos.created_at.eq.${decoded.createdAt},photos.id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: tags, error } = await query;

  if (error) {
    logger.error('Failed to fetch parent feed', {
      error: error.message,
      parentId,
    });
    throw new AppError('Failed to fetch feed', 500, 'QUERY_FAILED');
  }

  // Deduplicate photos (a photo may be tagged with multiple children)
  const seenIds = new Set<string>();
  const uniquePhotos: Array<Record<string, unknown>> = [];

  for (const tag of tags ?? []) {
    const photo = tag.photos as unknown as Record<string, unknown>;
    if (photo && !seenIds.has(photo.id as string)) {
      seenIds.add(photo.id as string);
      uniquePhotos.push(photo);
    }
  }

  const hasNext = uniquePhotos.length > limit;
  const results = uniquePhotos.slice(0, limit);

  const origin = baseUrl ?? env.BACKEND_URL;
  const photosWithUrls: PhotoWithUrl[] = results.map((photo) => {
    const url = `${origin}/uploads/${photo.s3_key as string}`;
    const thumbnailUrl = photo.thumbnail_s3_key
      ? `${origin}/uploads/${photo.thumbnail_s3_key as string}`
      : null;
    return {
      id: photo.id as string,
      s3_key: photo.s3_key as string,
      thumbnail_s3_key: photo.thumbnail_s3_key as string | null,
      blurhash: photo.blurhash as string | null,
      width: photo.width as number | null,
      height: photo.height as number | null,
      status: photo.status as string,
      created_at: photo.created_at as string,
      uploaded_by: photo.uploaded_by as string,
      class_id: photo.class_id as string,
      url,
      thumbnailUrl,
    };
  });

  const nextCursor =
    hasNext && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: results[results.length - 1].created_at,
            id: results[results.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { photos: photosWithUrls, nextCursor };
}
