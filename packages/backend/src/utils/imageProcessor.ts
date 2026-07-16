import sharp from 'sharp';
import { encode } from 'blurhash';
import { logger } from '../config/logger';
import { uploadPhotoObject } from './supabaseStorage';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_QUALITY = 80;
const HEIC_JPEG_QUALITY = 90;
const BLURHASH_SIZE = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

// sharp reports HEIC/HEIF containers as 'heif'.
const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'heif']);

export interface ProcessedPhoto {
  /** Final storage path of the original — differs from the input when HEIC was converted. */
  storagePath: string;
  /** Storage path of the 400px thumbnail. */
  thumbnailPath: string;
  /** Final MIME type — image/jpeg when HEIC was converted. */
  mimeType: string;
  width: number;
  height: number;
  blurhash: string | null;
}

/**
 * Validate, process and upload one image.
 *
 * Runs synchronously inside the upload request rather than through a queue.
 * A typical phone photo takes 100–300 ms, which is imperceptible next to the
 * upload itself, and it removes an entire class of "why is nothing processing"
 * failures. See docs/plans/00-INDEX.md, decision DEC-2.
 *
 * Steps:
 *   1. Verify the buffer really is an image (magic bytes, not the client's MIME)
 *   2. Convert HEIC to JPEG — Android cannot render HEIC
 *   3. Upload the original
 *   4. Generate and upload a 400px thumbnail
 *   5. Compute a blurhash placeholder
 */
export async function processAndUploadPhoto(
  buffer: Buffer,
  storagePath: string,
  declaredMimeType: string,
): Promise<ProcessedPhoto> {
  // 1. Trust the bytes, not the client. `middleware/upload.ts` checks the
  //    client-supplied MIME, which is trivially spoofed; sharp reads the header.
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error('File is not a readable image');
  }

  const format = metadata.format;
  if (!format || !SUPPORTED_FORMATS.has(format)) {
    throw new Error(`Unsupported image format: ${format ?? 'unknown'}`);
  }

  // 2. HEIC -> JPEG. iOS uploads HEIC by default and Android cannot display it.
  const isHeic = format === 'heif';
  let finalPath = storagePath;
  let mimeType = declaredMimeType;
  let originalBuffer = buffer;

  if (isHeic) {
    originalBuffer = await sharp(buffer).jpeg({ quality: HEIC_JPEG_QUALITY }).toBuffer();
    finalPath = storagePath.replace(/\.hei[cf]$/i, '.jpg');
    mimeType = 'image/jpeg';
  }

  const processedMeta = await sharp(originalBuffer).metadata();
  const width = processedMeta.width ?? 0;
  const height = processedMeta.height ?? 0;

  // 3. Original
  await uploadPhotoObject(finalPath, originalBuffer, mimeType);

  // 4. Thumbnail. `withoutEnlargement` avoids upscaling an already-small image.
  const thumbnailBuffer = await sharp(originalBuffer)
    .resize(THUMBNAIL_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  const thumbnailPath = finalPath.replace(/(\.[^.]+)$/, '_thumb.jpg');
  await uploadPhotoObject(thumbnailPath, thumbnailBuffer, 'image/jpeg');

  // 5. Blurhash. Non-fatal — a missing placeholder degrades the loading
  //    experience but should not fail an otherwise successful upload.
  let blurhash: string | null = null;
  try {
    const { data, info } = await sharp(originalBuffer)
      .resize(BLURHASH_SIZE, BLURHASH_SIZE, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y,
    );
  } catch (err) {
    logger.warn('Blurhash generation failed', {
      storagePath: finalPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('Photo processed', {
    storagePath: finalPath,
    thumbnailPath,
    width,
    height,
    converted: isHeic,
  });

  return { storagePath: finalPath, thumbnailPath, mimeType, width, height, blurhash };
}
