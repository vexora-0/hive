import { apiRequest } from '@/lib/api';
import { logger } from '@/utils/logger';
import type { FeedPhoto } from './parentService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
//
// The diary is fetched in two pieces, because a journey and a month are
// different sizes. The **outline** covers every month the child has been
// photographed in, however many years that is, and costs one cover print per
// month. A **chapter** is one of those months, opened on demand.
//
// Photographs inside a chapter are returned as `FeedPhoto`, the same shape the
// wall uses, so the viewer, the action sheet and `usePhotoActions` all work on
// a diary photograph without a translation layer.

/** The month's opening print. Enough to draw it, and nothing more. */
export interface DiaryCover {
  id: string;
  uri: string;
  thumbnailUri: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
}

export interface DiaryChapter {
  /** `YYYY-MM`, in the parent's own calendar. */
  month: string;
  /** The month's first and last photograph, as instants. */
  firstAt: string;
  lastAt: string;
  photoCount: number;
  /** How many separate days of that month have photographs. */
  dayCount: number;
  cover: DiaryCover | null;
}

export interface DiarySummary {
  firstPhotoAt: string | null;
  lastPhotoAt: string | null;
  totalPhotos: number;
  /** Days that have photographs — the days the diary actually holds. */
  totalDays: number;
  totalTeachers: number;
  /** True when the child has more photographs than one outline can scan. */
  truncated: boolean;
}

export interface DiaryOutline {
  student: {
    id: string;
    fullName: string;
    className: string | null;
    schoolName: string | null;
  };
  summary: DiarySummary;
  /** Oldest month first. The diary is read forwards. */
  chapters: DiaryChapter[];
}

/** One day of the diary: when it started, who was there, what was taken. */
export interface DiaryEntry {
  /** `YYYY-MM-DD`, in the parent's own calendar. */
  date: string;
  firstAt: string;
  lastAt: string;
  photoCount: number;
  teachers: string[];
  photos: FeedPhoto[];
}

export interface DiaryChapterPage {
  month: string;
  entries: DiaryEntry[];
  /** True when the month held more photographs than one response returns. */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

interface WireCover {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
}

interface WirePhoto extends WireCover {
  caption: string | null;
  created_at: string;
  uploadedBy: { id: string; name: string | null };
}

interface WireOutline {
  student: DiaryOutline['student'];
  summary: DiarySummary;
  chapters: Array<Omit<DiaryChapter, 'cover'> & { cover: WireCover | null }>;
}

interface WireChapterPage {
  month: string;
  entries: Array<Omit<DiaryEntry, 'photos'> & { photos: WirePhoto[] }>;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/**
 * The offset the server needs to bucket photographs into *this parent's* days.
 *
 * `getTimezoneOffset()` reports UTC minus local in minutes, so India Standard
 * Time is `-330`. It is read per call rather than once at module load: a phone
 * crossing a timezone — or coming out of a DST change — keeps its process, and
 * a cached offset would quietly file an evening under the wrong date.
 *
 * Without it the server would have to bucket in UTC, which would disagree with
 * the wall's own day headers. Two screens dating the same photograph
 * differently is the kind of defect nobody reports and everybody notices.
 */
function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

function toCover(cover: WireCover | null): DiaryCover | null {
  if (!cover) return null;
  return {
    id: cover.id,
    uri: cover.url,
    thumbnailUri: cover.thumbnailUrl,
    blurhash: cover.blurhash,
    width: cover.width,
    height: cover.height,
  };
}

/**
 * A diary photograph, in the shape the rest of the parent flow already speaks.
 *
 * `studentIds` is the child whose diary this is, and only that child — the
 * endpoint is scoped to one student, so there is no other name it could
 * honestly carry.
 */
function toFeedPhoto(photo: WirePhoto, studentId: string): FeedPhoto {
  return {
    id: photo.id,
    uri: photo.url,
    thumbnailUri: photo.thumbnailUrl,
    blurhash: photo.blurhash,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    createdAt: photo.created_at,
    uploadedBy: photo.uploadedBy ?? { id: '', name: null },
    studentIds: [studentId],
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** The outline of one child's whole journey — every month, in order. */
export async function getDiary(studentId: string): Promise<DiaryOutline> {
  const params = new URLSearchParams({
    studentId,
    tzOffset: String(tzOffset()),
  });

  logger.debug('diaryService.getDiary', { studentId });

  const res = await apiRequest<{ success: true; data: WireOutline }>(
    `/feed/diary?${params.toString()}`,
  );

  return {
    student: res.data.student,
    summary: res.data.summary,
    chapters: res.data.chapters.map((chapter) => ({
      ...chapter,
      cover: toCover(chapter.cover),
    })),
  };
}

/** One month of the diary, grouped into the days it actually happened on. */
export async function getDiaryChapter(
  studentId: string,
  month: string,
): Promise<DiaryChapterPage> {
  const params = new URLSearchParams({
    studentId,
    tzOffset: String(tzOffset()),
  });

  logger.debug('diaryService.getDiaryChapter', { studentId, month });

  const res = await apiRequest<{ success: true; data: WireChapterPage }>(
    `/feed/diary/${month}?${params.toString()}`,
  );

  return {
    month: res.data.month,
    truncated: res.data.truncated,
    entries: res.data.entries.map((entry) => ({
      ...entry,
      photos: entry.photos.map((photo) => toFeedPhoto(photo, studentId)),
    })),
  };
}
