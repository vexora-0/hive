import { supabaseAdmin } from '../config/supabase';

const PHOTOS_BUCKET = 'photos';

/**
 * Returns the public URL for a file in Supabase Storage (photos bucket).
 * Use for photo and thumbnail URLs in feeds and photo lists.
 */
export function getSupabasePhotoPublicUrl(storagePath: string): string {
  const { data } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Check if a file exists in Supabase Storage (download returns 200 if exists).
 */
export async function fileExistsInStorage(storagePath: string): Promise<boolean> {
  const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).download(storagePath);
  return !error;
}

export { PHOTOS_BUCKET };
