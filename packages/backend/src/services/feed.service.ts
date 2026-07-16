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

  // 2. Fetch a page of photos directly, filtered to those tagged with one of
  //    this parent's children.
  //
  //    The previous implementation fetched EVERY photo_student_tags row for the
  //    parent's children with no limit, collected the photo IDs, and passed them
  //    all back in as `.in('id', [...])`. For a child with a couple of thousand
  //    tagged photos that builds a URL containing thousands of UUIDs, and
  //    PostgREST returns 414 URI Too Long. The feed did not degrade as data grew
  //    — it stopped working. (G-14)
  //
  //    `photo_student_tags!inner` pushes the tag filter into the same query, so
  //    pagination happens in the database and the response size is bounded by
  //    `limit` regardless of how many photos exist.
  //
  //    A photo tagged with two of the parent's children matches twice, so we
  //    over-fetch and deduplicate below.
  const OVERFETCH = limit * 2 + 1;

  let photosQuery = supabaseAdmin
    .from('photos')
    .select(
      'id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id, photo_student_tags!inner(student_id)',
    )
    .in('photo_student_tags.student_id', studentIds)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(OVERFETCH);

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

  // 3. Deduplicate. The inner join emits one row per matching tag, so a photo
  //    containing two of this parent's children arrives twice.
  //
  //    hasNext is computed from the DEDUPLICATED count against `limit`, not from
  //    the raw row count. The dead getParentFeed removed in Plan 03 got this
  //    backwards and truncated the feed early whenever siblings appeared
  //    together in a photo.
  type TaggedRow = (typeof photos extends (infer R)[] | null ? R : never) & {
    photo_student_tags?: Array<{ student_id: string }>;
  };

  const seen = new Set<string>();
  const unique: TaggedRow[] = [];
  const photoStudentMap = new Map<string, string[]>();

  for (const row of (photos ?? []) as TaggedRow[]) {
    // Only this parent's children — never reveal which other children appear.
    const tagged = (row.photo_student_tags ?? [])
      .map((t) => t.student_id)
      .filter((id) => studentIds.includes(id));

    if (seen.has(row.id)) {
      const existing = photoStudentMap.get(row.id) ?? [];
      photoStudentMap.set(row.id, [...new Set([...existing, ...tagged])]);
      continue;
    }
    seen.add(row.id);
    photoStudentMap.set(row.id, [...new Set(tagged)]);
    unique.push(row);
  }

  // If the database returned the full over-fetch, it had more rows to give, so
  // there may be further photos even when dedup leaves us at exactly `limit`.
  // Erring towards `true` costs at most one empty page; erring towards `false`
  // silently truncates a parent's feed, which is the failure mode that matters.
  const hitFetchCeiling = (photos?.length ?? 0) >= OVERFETCH;
  const hasNext = unique.length > limit || (hitFetchCeiling && unique.length >= limit);
  const results = unique.slice(0, limit);

  // 4. The bucket is private, so every URL is signed. One batch call covers the
  //    whole page rather than two round trips per photo.
  const signed = await getSignedPhotoUrls(
    results.flatMap((p) => [p.s3_key, p.thumbnail_s3_key].filter(Boolean) as string[]),
  );

  const feedPhotos: FeedPhoto[] = results.map((photo) => {
    // photo_student_tags is a join artefact, not part of the API contract —
    // strip it so it never reaches the client.
    const rest = { ...photo } as Omit<TaggedRow, 'photo_student_tags'> &
      Partial<Pick<TaggedRow, 'photo_student_tags'>>;
    delete rest.photo_student_tags;
    return {
      ...rest,
      url: signed.get(photo.s3_key) ?? '',
      thumbnailUrl: photo.thumbnail_s3_key
        ? (signed.get(photo.thumbnail_s3_key) ?? null)
        : null,
      taggedStudentIds: photoStudentMap.get(photo.id) ?? [],
    };
  });

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

export async function getPhotoDetails(photoId: string, userId: string) {
  const { data: photo, error } = await supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id, original_filename, mime_type, file_size_bytes')
    .eq('id', photoId)
    .eq('status', 'ready')
    .single();

  if (error || !photo) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  // Authorization. The backend queries through supabaseAdmin, which holds the
  // service-role key and is exempt from RLS by design, so ownership has to be
  // checked explicitly here. The caller may read this photo only if one of
  // their own children is tagged in it.
  //
  // A caller who is not entitled to the photo gets 404, never 403: a 403 would
  // confirm that the photo exists, which is itself an information leak when the
  // ID space is enumerable.
  //
  // This runs before the signed URL is minted — a signed URL grants access to
  // the file itself, so it must never be generated for an unauthorised caller.
  const { data: links, error: linksError } = await supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', userId);

  if (linksError) {
    logger.error('Failed to fetch parent-student links', {
      error: linksError.message,
      userId,
    });
    throw new AppError('Failed to fetch student links', 500, 'QUERY_FAILED');
  }

  const ownStudentIds = links?.map((l) => l.student_id) ?? [];

  if (ownStudentIds.length === 0) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  const { data: ownTags, error: ownTagsError } = await supabaseAdmin
    .from('photo_student_tags')
    .select('student_id')
    .eq('photo_id', photoId)
    .in('student_id', ownStudentIds);

  if (ownTagsError) {
    logger.error('Failed to verify photo ownership', {
      error: ownTagsError.message,
      photoId,
      userId,
    });
    throw new AppError('Failed to fetch photo', 500, 'QUERY_FAILED');
  }

  if (!ownTags || ownTags.length === 0) {
    logger.warn('Blocked photo detail access', { photoId, userId });
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  // Get class and school names
  // PostgREST types an embedded to-one relation as an array, so it is narrowed
  // here rather than cast away with `any`.
  type ClassRow = { name: string | null; schools: { name: string | null } | null };
  const { data: classData } = await supabaseAdmin
    .from('classes')
    .select('name, schools(name)')
    .eq('id', photo.class_id)
    .single();
  const classRow = classData as ClassRow | null;

  const signed = await getSignedPhotoUrls(
    [photo.s3_key, photo.thumbnail_s3_key].filter(Boolean) as string[],
  );
  const url = signed.get(photo.s3_key) ?? '';
  const thumbnailUrl = photo.thumbnail_s3_key
    ? (signed.get(photo.thumbnail_s3_key) ?? null)
    : null;

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
    className: classRow?.name ?? null,
    schoolName: classRow?.schools?.name ?? null,
    // Only this parent's own children, never the full tag list. Authorisation
    // is not binary: a parent entitled to see the photo is still not entitled
    // to learn which other children appear in it.
    taggedStudentIds: ownTags.map((t) => t.student_id),
  };
}
