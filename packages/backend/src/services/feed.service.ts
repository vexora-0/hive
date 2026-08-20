import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import { getSignedPhotoUrls } from '../utils/supabaseStorage';
import { localFields, monthBoundsUtc } from '../utils/diaryCalendar';

interface FeedPhoto {
  id: string;
  s3_key: string;
  thumbnail_s3_key: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  status: string;
  created_at: string;
  uploadedBy: { id: string; name: string | null };
  class_id: string;
  url: string;
  thumbnailUrl: string | null;
  taggedStudentIds: string[];
}

interface FeedResult {
  photos: FeedPhoto[];
  nextCursor: string | null;
}

/** Shape of the embedded uploader profile, as PostgREST types it. */
type EmbeddedUploader =
  | { full_name: string | null }
  | { full_name: string | null }[]
  | null
  | undefined;

/**
 * Normalise an embedded profile into a display name.
 *
 * PostgREST types a to-one embed as an array even though it returns a single
 * object, and the profile may be missing entirely if the uploader's account was
 * deleted. Returns null in that case rather than an empty string, so the client
 * can decide whether to render an attribution line at all.
 */
function uploaderName(uploader: EmbeddedUploader): string | null {
  const row = Array.isArray(uploader) ? uploader[0] : uploader;
  return row?.full_name ?? null;
}

/**
 * Unwrap a to-one embed.
 *
 * PostgREST types an embedded to-one relation as an array whatever it actually
 * returns, and a nested embed is typed as an array at every level. This takes
 * one level off, and is applied once per level rather than casting the whole
 * shape to something the response never has.
 */
function first<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
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
      // `uploader` is embedded rather than fetched per photo — the client shows
      // who took the picture, and a second query per row would be N+1 on a page
      // of twenty. The constraint is named explicitly so the join cannot become
      // ambiguous if another photos → profiles foreign key is ever added.
      'id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id, uploader:profiles!photos_uploaded_by_fkey(full_name), photo_student_tags!inner(student_id)',
    )
    .in('photo_student_tags.student_id', studentIds)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(OVERFETCH);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    photosQuery = photosQuery.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
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
    uploader?: EmbeddedUploader;
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
    // photo_student_tags and uploader are join artefacts, not part of the API
    // contract — strip them so they never reach the client. The uploader's name
    // is re-exposed below in the shape the client actually consumes.
    const rest = { ...photo } as Omit<TaggedRow, 'photo_student_tags' | 'uploader'> &
      Partial<Pick<TaggedRow, 'photo_student_tags' | 'uploader'>> & { uploaded_by?: string };
    delete rest.photo_student_tags;
    delete rest.uploader;
    delete rest.uploaded_by;
    return {
      ...rest,
      url: signed.get(photo.s3_key) ?? '',
      thumbnailUrl: photo.thumbnail_s3_key
        ? (signed.get(photo.thumbnail_s3_key) ?? null)
        : null,
      uploadedBy: {
        id: photo.uploaded_by,
        name: uploaderName(photo.uploader),
      },
      taggedStudentIds: photoStudentMap.get(photo.id) ?? [],
    };
  });

  // 5. Build next cursor
  const last = results[results.length - 1];
  const nextCursor =
    hasNext && results.length > 0 ? encodeCursor(last.created_at, last.id) : null;

  return { photos: feedPhotos, nextCursor };
}

export async function getPhotoDetails(photoId: string, userId: string) {
  // Ownership first. Without this any authenticated parent could read any
  // photo by UUID — its URL, filename, class, school and the full list of
  // tagged children, including families at other schools. (G-04)
  const { data: ownLinks } = await supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id')
    .eq('parent_id', userId);

  const ownStudentIds = ownLinks?.map((l) => l.student_id) ?? [];
  if (ownStudentIds.length === 0) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  const { count: visible } = await supabaseAdmin
    .from('photo_student_tags')
    .select('id', { count: 'exact', head: true })
    .eq('photo_id', photoId)
    .in('student_id', ownStudentIds);

  // 404 rather than 403 — a 403 confirms the photo exists, which is itself a
  // disclosure.
  if (!visible) {
    throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
  }

  const { data: photo, error } = await supabaseAdmin
    .from('photos')
    .select('id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id, original_filename, mime_type, file_size_bytes, uploader:profiles!photos_uploaded_by_fkey(full_name)')
    .eq('id', photoId)
    .eq('status', 'ready')
    .single();

  if (error || !photo) {
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
    uploadedBy: {
      id: photo.uploaded_by,
      name: uploaderName((photo as { uploader?: EmbeddedUploader }).uploader),
    },
    class_id: photo.class_id,
    original_filename: photo.original_filename,
    mime_type: photo.mime_type,
    file_size_bytes: photo.file_size_bytes,
    className: classRow?.name ?? null,
    schoolName: classRow?.schools?.name ?? null,
    // Only this parent's children — an authorised viewer still must not learn
    // which other children appear in the frame.
    taggedStudentIds: (tags ?? [])
      .map((t) => t.student_id)
      .filter((id) => ownStudentIds.includes(id)),
  };
}

// ---------------------------------------------------------------------------
// The diary
// ---------------------------------------------------------------------------
//
// The feed answers "what arrived recently". The diary answers a different
// question — "how has this year gone" — and it needs a shape the feed cannot
// give it. A cursor-paginated run of photographs newest-first can only be read
// forwards by loading the whole thing, and the parent who wants to see their
// child's first week is exactly the parent furthest from the cursor.
//
// So the diary is served as an **outline plus chapters**. The outline is one
// bounded response covering the entire journey: every month the child has
// photographs in, how many, over how many days, and one cover print each. It is
// the whole timeline, and it is a handful of kilobytes however long the child
// has been at school. A chapter is then fetched only when the parent opens it.
//
// Two rules hold both endpoints together:
//
//  1. **The calendar is the viewer's, not the server's.** The client sends
//     `tzOffset` (`Date.prototype.getTimezoneOffset()`), and every month and day
//     boundary is computed against it — see `utils/diaryCalendar`, which holds
//     that arithmetic and is unit-tested without a database. Bucketing in UTC
//     would have been simpler and would have been wrong for any school far
//     enough east or west that a school day crosses midnight UTC.
//  2. **Ownership is checked before anything is read.** A diary is a
//     child-shaped resource, so `studentId` is required and must belong to the
//     caller. Failing it answers 404 rather than 403, for the same reason
//     `getPhotoDetails` does: a 403 confirms the child exists.

/**
 * How many photographs the outline will scan.
 *
 * The outline genuinely needs every row — it is counting months and days — so
 * this is the one query in the product that is not paginated. The ceiling makes
 * that bounded: at three photographs a school day a child reaches roughly 600 a
 * year, so 4000 covers a full preschool career several times over. A child
 * beyond it gets an outline built from their first 4000 photographs rather than
 * a failed request, and `truncated` says so rather than leaving the client to
 * believe the journey ended.
 */
const DIARY_SCAN_LIMIT = 4000;

/**
 * How many photographs one chapter will return.
 *
 * A month of a busy class is a few hundred; the cap keeps one response — and
 * the batch of signed URLs behind it — bounded even for a month nobody
 * anticipated.
 */
const DIARY_CHAPTER_LIMIT = 300;

export interface DiaryPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  uploadedBy: { id: string; name: string | null };
}

export interface DiaryChapter {
  /** `YYYY-MM` in the viewer's calendar. */
  month: string;
  /** First and last photograph of the month, as instants. */
  firstAt: string;
  lastAt: string;
  photoCount: number;
  /** Distinct days in the month that have photographs. */
  dayCount: number;
  /** The month's opening print. Null only if signing failed. */
  cover: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
}

export interface DiaryOutline {
  student: {
    id: string;
    fullName: string;
    className: string | null;
    schoolName: string | null;
  };
  summary: {
    firstPhotoAt: string | null;
    lastPhotoAt: string | null;
    totalPhotos: number;
    /** Distinct days with photographs — the days the diary actually has. */
    totalDays: number;
    /** Distinct teachers who contributed. */
    totalTeachers: number;
    /** True when the scan ceiling was reached; the journey runs further back. */
    truncated: boolean;
  };
  /** Oldest month first — the diary is read forwards. */
  chapters: DiaryChapter[];
}

export interface DiaryChapterPage {
  month: string;
  entries: Array<{
    /** `YYYY-MM-DD` in the viewer's calendar. */
    date: string;
    firstAt: string;
    lastAt: string;
    photoCount: number;
    /** Who was behind the camera that day, in the order they first appear. */
    teachers: string[];
    photos: DiaryPhoto[];
  }>;
  /** True when the month held more photographs than one response returns. */
  truncated: boolean;
}

/**
 * Confirm the caller is a parent of this child.
 *
 * 404 rather than 403 — see `getPhotoDetails`. Every diary read goes through
 * here first, so no query below has to re-establish the boundary.
 */
async function assertStudentLinked(userId: string, studentId: string): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from('parent_student_mappings')
    .select('student_id', { count: 'exact', head: true })
    .eq('parent_id', userId)
    .eq('student_id', studentId);

  if (error) {
    logger.error('Failed to verify parent-student link', {
      error: error.message,
      userId,
    });
    throw new AppError('Failed to load diary', 500, 'QUERY_FAILED');
  }

  if (!count) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }
}

/** Shape of the rows both diary queries read, before signing. */
interface DiaryRow {
  id: string;
  s3_key: string;
  thumbnail_s3_key: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string;
  uploader?: EmbeddedUploader;
}

/**
 * The whole journey, as an outline.
 *
 * One pass over the child's photographs in ascending order, bucketed into the
 * viewer's months. Only the covers are signed — one URL per month rather than
 * one per photograph — which is what keeps a two-year diary the same cost as a
 * two-week one.
 */
export async function getDiary(
  userId: string,
  studentId: string,
  tzOffsetMinutes: number,
): Promise<DiaryOutline> {
  await assertStudentLinked(userId, studentId);

  const { data: studentRow, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, full_name, classes:class_id(name, schools(name))')
    .eq('id', studentId)
    .single();

  if (studentError || !studentRow) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  // PostgREST types every to-one embed as an array, at both levels of this
  // nesting, even though it returns a single object. `first` unwraps one level
  // and is applied twice rather than casting the whole shape away.
  const classEmbed = first(studentRow.classes);
  const schoolEmbed = first(classEmbed?.schools);

  // Fetched **newest-first and reversed**, not fetched ascending.
  //
  // The diary is read forwards, so ascending is the order it is bucketed in —
  // but the order the *ceiling* cuts in is the opposite question. Scanning
  // ascending and stopping at the limit would drop the newest photographs,
  // which is to say it would drop this afternoon: a child past the ceiling
  // would open their diary and find it ended a year ago. Cutting from the far
  // end instead loses the beginning, which is at least the half a parent has
  // already seen, and it is what `summary.truncated` then honestly reports.
  //
  // No dedup pass here, unlike `getFeed`: that one filters on a *set* of the
  // parent's children and a photograph of two siblings matches twice. This
  // filters on exactly one student, and `uq_photo_student_tag` makes at most one
  // tag row per (photo, student).
  const { data: rows, error: photosError } = await supabaseAdmin
    .from('photos')
    .select(
      'id, s3_key, thumbnail_s3_key, blurhash, width, height, caption, created_at, uploaded_by, photo_student_tags!inner(student_id)',
    )
    .eq('photo_student_tags.student_id', studentId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(DIARY_SCAN_LIMIT);

  if (photosError) {
    logger.error('Failed to fetch diary outline', {
      error: photosError.message,
      userId,
      studentId,
    });
    throw new AppError('Failed to load diary', 500, 'QUERY_FAILED');
  }

  // Back into reading order. Everything below depends on it: months are
  // bucketed in insertion order, and a chapter's cover is the first row seen
  // for that month — which is only "the print the month opened on" if the rows
  // arrive oldest-first.
  const photos = ((rows ?? []) as unknown as DiaryRow[]).reverse();

  interface Bucket {
    month: string;
    firstAt: string;
    lastAt: string;
    photoCount: number;
    days: Set<string>;
    cover: DiaryRow;
  }

  const buckets = new Map<string, Bucket>();
  const allDays = new Set<string>();
  const teachers = new Set<string>();

  for (const photo of photos) {
    const { month, date } = localFields(photo.created_at, tzOffsetMinutes);
    allDays.add(date);
    if (photo.uploaded_by) teachers.add(photo.uploaded_by);

    const bucket = buckets.get(month);
    if (bucket) {
      bucket.photoCount += 1;
      bucket.lastAt = photo.created_at;
      bucket.days.add(date);
    } else {
      buckets.set(month, {
        month,
        firstAt: photo.created_at,
        lastAt: photo.created_at,
        photoCount: 1,
        days: new Set([date]),
        // Rows arrive ascending, so the first one seen for a month opened it.
        cover: photo,
      });
    }
  }

  const covers = [...buckets.values()].map((b) => b.cover);
  const signed = await getSignedPhotoUrls(
    covers.flatMap((c) => [c.s3_key, c.thumbnail_s3_key].filter(Boolean) as string[]),
  );

  const chapters: DiaryChapter[] = [...buckets.values()].map((bucket) => ({
    month: bucket.month,
    firstAt: bucket.firstAt,
    lastAt: bucket.lastAt,
    photoCount: bucket.photoCount,
    dayCount: bucket.days.size,
    cover: {
      id: bucket.cover.id,
      url: signed.get(bucket.cover.s3_key) ?? '',
      thumbnailUrl: bucket.cover.thumbnail_s3_key
        ? (signed.get(bucket.cover.thumbnail_s3_key) ?? null)
        : null,
      blurhash: bucket.cover.blurhash,
      width: bucket.cover.width,
      height: bucket.cover.height,
    },
  }));

  return {
    student: {
      id: studentRow.id,
      fullName: studentRow.full_name,
      className: classEmbed?.name ?? null,
      schoolName: schoolEmbed?.name ?? null,
    },
    summary: {
      firstPhotoAt: photos[0]?.created_at ?? null,
      lastPhotoAt: photos[photos.length - 1]?.created_at ?? null,
      totalPhotos: photos.length,
      totalDays: allDays.size,
      totalTeachers: teachers.size,
      truncated: photos.length >= DIARY_SCAN_LIMIT,
    },
    chapters,
  };
}

/**
 * One chapter — a month of the diary, grouped into days.
 *
 * Fetched when a parent opens the month, so the outline stays cheap and the
 * signing cost is paid only for photographs somebody is actually looking at.
 */
export async function getDiaryChapter(
  userId: string,
  studentId: string,
  month: string,
  tzOffsetMinutes: number,
): Promise<DiaryChapterPage> {
  await assertStudentLinked(userId, studentId);

  const { start, end } = monthBoundsUtc(month, tzOffsetMinutes);

  // One over the cap, so a full month can be reported as truncated rather than
  // silently ending on a round number.
  const { data: rows, error } = await supabaseAdmin
    .from('photos')
    .select(
      'id, s3_key, thumbnail_s3_key, blurhash, width, height, caption, created_at, uploaded_by, uploader:profiles!photos_uploaded_by_fkey(full_name), photo_student_tags!inner(student_id)',
    )
    .eq('photo_student_tags.student_id', studentId)
    .eq('status', 'ready')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(DIARY_CHAPTER_LIMIT + 1);

  if (error) {
    logger.error('Failed to fetch diary chapter', {
      error: error.message,
      userId,
      studentId,
      month,
    });
    throw new AppError('Failed to load diary', 500, 'QUERY_FAILED');
  }

  const all = (rows ?? []) as unknown as DiaryRow[];
  const truncated = all.length > DIARY_CHAPTER_LIMIT;
  const photos = truncated ? all.slice(0, DIARY_CHAPTER_LIMIT) : all;

  const signed = await getSignedPhotoUrls(
    photos.flatMap((p) => [p.s3_key, p.thumbnail_s3_key].filter(Boolean) as string[]),
  );

  interface DayBucket {
    date: string;
    firstAt: string;
    lastAt: string;
    teachers: string[];
    photos: DiaryPhoto[];
  }

  const days = new Map<string, DayBucket>();

  for (const photo of photos) {
    const { date } = localFields(photo.created_at, tzOffsetMinutes);
    const name = uploaderName(photo.uploader);

    const entry: DiaryPhoto = {
      id: photo.id,
      url: signed.get(photo.s3_key) ?? '',
      thumbnailUrl: photo.thumbnail_s3_key
        ? (signed.get(photo.thumbnail_s3_key) ?? null)
        : null,
      blurhash: photo.blurhash,
      width: photo.width,
      height: photo.height,
      caption: photo.caption,
      created_at: photo.created_at,
      uploadedBy: { id: photo.uploaded_by, name },
    };

    const bucket = days.get(date);
    if (bucket) {
      bucket.lastAt = photo.created_at;
      bucket.photos.push(entry);
      if (name && !bucket.teachers.includes(name)) bucket.teachers.push(name);
    } else {
      days.set(date, {
        date,
        firstAt: photo.created_at,
        lastAt: photo.created_at,
        teachers: name ? [name] : [],
        photos: [entry],
      });
    }
  }

  return {
    month,
    entries: [...days.values()].map((day) => ({
      date: day.date,
      firstAt: day.firstAt,
      lastAt: day.lastAt,
      photoCount: day.photos.length,
      teachers: day.teachers,
      photos: day.photos,
    })),
    truncated,
  };
}
