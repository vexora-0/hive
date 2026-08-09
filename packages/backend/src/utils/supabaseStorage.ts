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

/**
 * True if the object exists in the bucket. Used to confirm an upload landed.
 *
 * Lists the containing folder rather than downloading the object. The previous
 * implementation called `.download()` — pulling the entire image into backend
 * memory and discarding it — to answer a boolean, on every `/confirm`. A
 * twenty-photo session moved up to half a gigabyte of egress for no reason,
 * serialised behind the confirm response.
 */
export async function fileExistsInStorage(storagePath: string): Promise<boolean> {
  const lastSlash = storagePath.lastIndexOf('/');
  const folder = lastSlash === -1 ? '' : storagePath.slice(0, lastSlash);
  const name = lastSlash === -1 ? storagePath : storagePath.slice(lastSlash + 1);

  const { data, error } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .list(folder, { limit: 1, search: name });

  if (error) {
    logger.warn('Failed to check storage object', { storagePath, error: error.message });
    return false;
  }

  // `search` is a substring match, so confirm the name matches exactly.
  return (data ?? []).some((entry) => entry.name === name);
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
