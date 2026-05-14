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
 */
export async function uploadPhotoFile(
  photoId: string,
  localUri: string,
  contentType: string,
  filename: string,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: contentType,
    name: filename,
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/api/v1/photos/${photoId}/file`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    logger.error('Photo file upload failed', { status: response.status, errorBody, photoId });
    throw new Error(errorBody.message ?? 'File upload failed');
  }
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
