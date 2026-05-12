import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { getSignedPhotoUrls } from '../utils/supabaseStorage';

interface FeedPhoto {
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
  taggedStudentIds: string[];
}

interface FeedResult {
  photos: FeedPhoto[];
  nextCursor: string | null;
}

export async function getFeed(
  userId: string,
  studentId?: string,
  cursor?: string,
  limit: number = 20,
): Promise<FeedResult> {
  // 1. Get student IDs for parent
  let studentQuery = supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', userId);

  if (studentId) {
    studentQuery = studentQuery.eq('student_id', studentId);
  }

  const { data: links, error: linksError } = await studentQuery;

  if (linksError) {
    logger.error('Failed to fetch parent-student links', {
      error: linksError.message,
      userId,
    });
    throw new AppError('Failed to fetch student links', 500, 'QUERY_FAILED');
  }

  const studentIds = links?.map((l) => l.student_id) ?? [];

  if (studentIds.length === 0) {
    return { photos: [], nextCursor: null };
  }

  // 2. Build query: photos tagged with parent's students, status='ready'
  //    Using a subquery approach: get photo IDs from tags, then fetch photos
  const tagQuery = supabaseAdmin
    .from('photo_student_tags')
    .select('photo_id, student_id')
    .in('student_id', studentIds);

  const { data: allTags, error: tagsError } = await tagQuery;

  if (tagsError) {
    logger.error('Failed to fetch photo tags', {
      error: tagsError.message,
      userId,
    });
    throw new AppError('Failed to fetch feed', 500, 'QUERY_FAILED');
  }

  if (!allTags || allTags.length === 0) {
    return { photos: [], nextCursor: null };
  }

  // Group student IDs by photo
  const photoStudentMap = new Map<string, string[]>();
  for (const tag of allTags) {
    const existing = photoStudentMap.get(tag.photo_id) ?? [];
    existing.push(tag.student_id);
    photoStudentMap.set(tag.photo_id, existing);
  }

  const photoIds = Array.from(photoStudentMap.keys());

  // 3. Fetch photos with cursor pagination (created_at DESC, id DESC)
  let photosQuery = supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id')
    .in('id', photoIds)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      photosQuery = photosQuery.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: photos, error: photosError } = await photosQuery;

  if (photosError) {
    logger.error('Failed to fetch feed photos', {
      error: photosError.message,
      userId,
    });
    throw new AppError('Failed to fetch feed', 500, 'QUERY_FAILED');
  }

  const hasNext = (photos?.length ?? 0) > limit;
  const results = photos?.slice(0, limit) ?? [];

  // 4. The bucket is private, so every URL is signed. One batch call covers the
  //    whole page rather than two round trips per photo.
  const signed = await getSignedPhotoUrls(
    results.flatMap((p) => [p.s3_key, p.thumbnail_s3_key].filter(Boolean) as string[]),
  );

  const feedPhotos: FeedPhoto[] = results.map((photo) => ({
    ...photo,
    url: signed.get(photo.s3_key) ?? '',
    thumbnailUrl: photo.thumbnail_s3_key
      ? (signed.get(photo.thumbnail_s3_key) ?? null)
      : null,
    taggedStudentIds: photoStudentMap.get(photo.id) ?? [],
  }));

  // 5. Build next cursor
  const nextCursor =
    hasNext && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: results[results.length - 1].created_at,
            id: results[results.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { photos: feedPhotos, nextCursor };
}

export async function getPhotoDetails(photoId: string) {
  const { data: photo, error } = await supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id, original_filename, mime_type, file_size_bytes')
    .eq('id', photoId)
    .eq('status', 'ready')
    .single();

  if (error || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  // Get class and school names
  const { data: classData } = await supabaseAdmin
    .from('classes')
    .select('name, schools(name)')
    .eq('id', photo.class_id)
    .single();

  const signed = await getSignedPhotoUrls(
    [photo.s3_key, photo.thumbnail_s3_key].filter(Boolean) as string[],
  );
  const url = signed.get(photo.s3_key) ?? '';
  const thumbnailUrl = photo.thumbnail_s3_key
    ? (signed.get(photo.thumbnail_s3_key) ?? null)
    : null;

  // Get tagged student IDs
  const { data: tags } = await supabaseAdmin
    .from('photo_student_tags')
    .select('student_id')
    .eq('photo_id', photoId);

  return {
    id: photo.id,
    url,
    thumbnailUrl,
    blurhash: photo.blurhash,
    width: photo.width,
    height: photo.height,
    created_at: photo.created_at,
    uploaded_by: photo.uploaded_by,
    class_id: photo.class_id,
    original_filename: photo.original_filename,
    mime_type: photo.mime_type,
    file_size_bytes: photo.file_size_bytes,
    className: (classData as any)?.name ?? null,
    schoolName: (classData as any)?.schools?.name ?? null,
    taggedStudentIds: tags?.map((t) => t.student_id) ?? [],
  };
}
