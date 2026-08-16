import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiRequest, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import type { StudentItem } from '@/components/forms/StudentTagger';

/**
 * Deadline for a single file transfer. Generous enough for a 25MB photo on a
 * slow mobile connection, short enough that a dead connection surfaces as an
 * error the teacher can act on rather than an indefinite spinner.
 */
const UPLOAD_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadUrlRequest {
  classId: string;
  filename: string;
  contentType: string;
  /** Optional: the picker does not always report a size. */
  fileSize?: number;
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

  if (Platform.OS === 'web') {
    // ── Web ──────────────────────────────────────────────────────────
    //
    // Browsers have no `{uri, type, name}` convention. `FormData.append` takes
    // a Blob or a string and **stringifies anything else**, so the React Native
    // shape below arrives at the server as a text field containing the literal
    // "[object Object]". Multer then finds no file part and the request fails
    // with `400 No file provided` — which is what it did, on web only, while
    // the same code worked on a device.
    //
    // The picker hands back a `blob:` or `data:` URL here, and `fetch` reads
    // both, so the file is pulled back into a real Blob and appended as one.
    const response = await fetch(localUri);
    const blob = await response.blob();
    formData.append('file', blob, filename);
  } else {
    // ── iOS / Android ────────────────────────────────────────────────
    //
    // The native FormData implementation resolves this shape by reading the
    // file off disk, which is what keeps a 4MB photograph out of JavaScript
    // memory. Do not "fix" this branch to match the web one.
    formData.append('file', {
      uri: localUri,
      type: contentType,
      name: filename,
    } as unknown as Blob);
  }

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

    // Without a deadline a stalled connection — a captive portal, a carrier
    // handoff — leaves this promise unsettled until the OS gives up on the
    // socket, which is minutes. The tile sits on "Uploading" the whole time
    // with its remove button hidden and the upload button disabled, so the
    // screen has no exit but navigating away and losing the batch.
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = 'File upload failed';
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
        message = (body as { message?: string })?.message ?? message;
      } catch {
        // Non-JSON body — a proxy error page, say. Keep the generic message.
      }
      logger.error('Photo file upload failed', { status: xhr.status, message, photoId });
      // An ApiError, not a bare Error: `isRetryable` reads the status to decide
      // whether another attempt could possibly help. Rejecting with a plain
      // Error made every 4xx here look like a network blip, so an unsupported
      // file type was re-sent in full three times.
      reject(new ApiError(xhr.status, message, body));
    };

    // Covers connection failure and, separately, the user aborting. Neither
    // reaches onload, so without these the promise would never settle.
    xhr.onerror = () => {
      logger.error('Photo file upload errored', { photoId });
      reject(new Error('Network request failed'));
    };
    xhr.ontimeout = () => {
      logger.error('Photo file upload timed out', { photoId });
      reject(new Error('The upload timed out. Check your connection and try again.'));
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
