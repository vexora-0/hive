import { apiRequest } from '@/lib/api';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedPhoto {
  id: string;
  uri: string;
  thumbnailUri: string | null;
  blurhash: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  studentIds: string[];
}

export interface FeedPage {
  photos: FeedPhoto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PhotoDetails extends FeedPhoto {
  originalFilename: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  className: string | null;
  schoolName: string | null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch the parent feed.
 *
 * The cursor format is `{created_at}_{id}` and is returned by the API
 * as `nextCursor` in each response page.
 */
interface BackendFeedPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  class_id: string;
  taggedStudentIds: string[];
}

export async function getFeed(
  studentId?: string,
  cursor?: string,
  limit: number = 20,
): Promise<FeedPage> {
  const params = new URLSearchParams();

  if (studentId) {
    params.append('studentId', studentId);
  }
  if (cursor) {
    params.append('cursor', cursor);
  }
  params.append('limit', String(limit));

  const query = params.toString();
  const endpoint = `/feed${query ? `?${query}` : ''}`;

  logger.debug('parentService.getFeed', { studentId, cursor, limit });

  const res = await apiRequest<{
    success: true;
    data: BackendFeedPhoto[];
    cursor: string | null;
  }>(endpoint);

  const photos: FeedPhoto[] = (res.data ?? []).map((p) => ({
    id: p.id,
    uri: p.url,
    thumbnailUri: p.thumbnailUrl,
    blurhash: p.blurhash,
    caption: null,
    width: p.width,
    height: p.height,
    createdAt: p.created_at,
    uploadedBy: { id: p.uploaded_by, name: '' },
    studentIds: p.taggedStudentIds ?? [],
  }));

  return {
    photos,
    nextCursor: res.cursor ?? null,
    hasMore: !!res.cursor,
  };
}

/**
 * Fetch detailed information about a single photo.
 *
 * The backend returns snake_case / different field names, so we map them
 * to match the `PhotoDetails` (camelCase) interface used by the UI.
 */
interface BackendPhotoDetails {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  uploaded_by: string;
  class_id: string;
  original_filename: string | null;
  mime_type: string;
  file_size_bytes: number | null;
  className: string | null;
  schoolName: string | null;
  taggedStudentIds: string[];
}

export async function getPhotoDetails(photoId: string): Promise<PhotoDetails> {
  logger.debug('parentService.getPhotoDetails', { photoId });

  const res = await apiRequest<{ success: true; data: BackendPhotoDetails }>(`/feed/photos/${photoId}`);
  const p = res.data;

  return {
    id: p.id,
    uri: p.url,
    thumbnailUri: p.thumbnailUrl,
    blurhash: p.blurhash,
    caption: null,
    width: p.width,
    height: p.height,
    createdAt: p.created_at,
    uploadedBy: { id: p.uploaded_by, name: '' },
    studentIds: p.taggedStudentIds ?? [],
    originalFilename: p.original_filename,
    mimeType: p.mime_type,
    fileSizeBytes: p.file_size_bytes,
    className: p.className,
    schoolName: p.schoolName,
  };
}
