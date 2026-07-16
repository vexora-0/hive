import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

const PHOTOS_BUCKET = 'photos';

/** How long an issued photo URL stays valid. */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Upload a buffer to the photos bucket.
 *
 * `upsert` is enabled so a retried upload overwrites rather than failing — the
 * object key derives from the photo's UUID, so a collision can only be the same
 * photo being retried.
 */
export async function uploadPhotoObject(
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, body, { contentType, upsert: true });

  if (error) {
    logger.error('Storage upload failed', { storagePath, error: error.message });
    throw new Error(`Failed to upload ${storagePath}: ${error.message}`);
  }
}

/**
 * Issue a short-lived signed URL for one object.
 *
 * The bucket is private (migration 00020), so this is the only way to read a
 * photo. Returns null rather than throwing — a missing thumbnail should degrade
 * to showing the original, not fail the whole request.
 */
export async function getSignedPhotoUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data) {
    logger.warn('Failed to sign photo URL', { storagePath, error: error?.message });
    return null;
  }
  return data.signedUrl;
}

/**
 * Sign many objects in one round trip.
 *
 * A feed page signs up to 40 objects (original + thumbnail for 20 photos); one
 * request beats forty. Returns a path -> URL map, omitting any that failed.
 */
export async function getSignedPhotoUrls(
  storagePaths: string[],
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const paths = [...new Set(storagePaths.filter(Boolean))];
  if (paths.length === 0) return result;

  const { data, error } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(paths, expiresIn);

  if (error || !data) {
    logger.error('Batch URL signing failed', {
      count: paths.length,
      error: error?.message,
    });
    return result;
  }

  for (const entry of data) {
    if (entry.signedUrl && entry.path) {
      result.set(entry.path, entry.signedUrl);
    }
  }
  return result;
}

/** True if the object exists in the bucket. Used to confirm an upload landed. */
export async function fileExistsInStorage(storagePath: string): Promise<boolean> {
  const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).download(storagePath);
  return !error;
}

/** Remove objects from the bucket. Used to clean up after a failed upload. */
export async function deletePhotoObjects(storagePaths: string[]): Promise<void> {
  const paths = storagePaths.filter(Boolean);
  if (paths.length === 0) return;

  const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove(paths);
  if (error) {
    logger.warn('Failed to remove storage objects', { paths, error: error.message });
  }
}

export { PHOTOS_BUCKET };
