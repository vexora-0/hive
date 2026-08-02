import Constants from 'expo-constants';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import type { StudentItem } from '@/components/forms/StudentTagger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadUrlRequest {
  classId: string;
  filename: string;
  contentType: string;
  fileSize: number;
}

export interface UploadUrlResponse {
  photoId: string;
  s3Key: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * Request a photo slot from the backend. Returns photoId and storage path.
 */
export async function requestUploadUrl(data: UploadUrlRequest): Promise<UploadUrlResponse> {
  const res = await apiRequest<{ success: true; data: UploadUrlResponse }>('/photos/upload-url', {
    method: 'POST',
    body: data,
  });
  return res.data;
}

/**
 * Upload photo file directly to the backend via multipart/form-data.
 * Replaces the old Supabase Storage upload + confirm steps.
 *
 * Uses `XMLHttpRequest` rather than `fetch` for one reason: `fetch` gives no
 * upload progress. The bar used to jump 0.35 → 0.85 across the whole transfer,
 * which is the only part that actually takes time — a teacher uploading twenty
 * photos on school wifi watched a frozen bar and had no way to tell a slow
 * upload from a stalled one. `xhr.upload.onprogress` reports bytes as they go
 * out. (G-27)
 *
 * `onProgress` receives 0–1 for THIS file only; the caller maps it into
 * whatever band it reserves for the transfer.
 */
export async function uploadPhotoFile(
  photoId: string,
  localUri: string,
  contentType: string,
  filename: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: contentType,
    name: filename,
  } as unknown as Blob);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/v1/photos/${photoId}/file`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    // Content-Type is deliberately not set — the platform has to add the
    // multipart boundary, and setting it by hand strips it.

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = 'File upload failed';
      try {
        message = JSON.parse(xhr.responseText)?.message ?? message;
      } catch {
        // Non-JSON body — a proxy error page, say. Keep the generic message.
      }
      logger.error('Photo file upload failed', { status: xhr.status, message, photoId });
      reject(new Error(message));
    };

    // Covers connection failure and, separately, the user aborting. Neither
    // reaches onload, so without these the promise would never settle.
    xhr.onerror = () => {
      logger.error('Photo file upload errored', { photoId });
      reject(new Error('Network request failed'));
    };
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(formData);
  });
}

/**
 * Confirm that the upload has completed and the photo is ready.
 * (Only needed if using the old Supabase Storage flow.)
 */
export async function confirmUpload(photoId: string): Promise<void> {
  await apiRequest(`/photos/${photoId}/confirm`, {
    method: 'POST',
  });
}

/**
 * Tag students in a photo.
 */
export async function tagStudents(
  photoId: string,
  studentIds: string[],
): Promise<void> {
  await apiRequest(`/photos/${photoId}/tag`, {
    method: 'POST',
    body: { studentIds },
  });
}

/**
 * Archive a photo.
 *
 * A soft delete server-side: the photo leaves this grid and every parent's
 * feed, but the stored objects stay so that any order already placed against
 * it still renders. Only the teacher who uploaded it (or an admin) may do this.
 */
export async function archivePhoto(photoId: string): Promise<void> {
  await apiRequest(`/photos/${photoId}`, {
    method: 'DELETE',
  });
}

/**
 * Remove one student's tag from a photo.
 *
 * This is the correction for tagging the wrong child — it revokes that one
 * family's access and leaves everybody else's alone.
 */
export async function untagStudent(
  photoId: string,
  studentId: string,
): Promise<void> {
  await apiRequest(`/photos/${photoId}/tag/${studentId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch students belonging to a particular class from supabase.
 */
export async function getClassStudents(classId: string): Promise<StudentItem[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, avatar_url')
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    logger.error('Failed to fetch class students:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name,
    avatarUrl: row.avatar_url ?? null,
  }));
}
