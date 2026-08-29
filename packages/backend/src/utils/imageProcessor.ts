import sharp from 'sharp';
import { encode } from 'blurhash';
import { logger } from '../config/logger';
import { uploadPhotoObject, deletePhotoObjects } from './supabaseStorage';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_QUALITY = 80;
const HEIC_JPEG_QUALITY = 90;
const BLURHASH_SIZE = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

/**
 * Formats sharp is allowed to decode here.
 *
 * This set is the last of four allow-lists a photo passes — the mobile picker,
 * `requestUploadSchema`, `middleware/upload.ts`, then here — and it is the only
 * one applied *after* the bytes have been transferred. When the other three
 * gained `image/webp` and this one did not, a WebP was accepted at every gate,
 * uploaded in full, and only then rejected with 400 INVALID_IMAGE: precisely
 * the wasted-transfer failure the earlier gates exist to prevent.
 *
 * sharp reports HEIC/HEIF containers as 'heif' and WebP as 'webp'. WebP
 * decoding is unconditional in libvips (unlike HEIF, which depends on codec
 * plugins — see the HEIC note below), so it needs no conversion branch:
 * Android and iOS both render WebP natively.
 */
const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'heif', 'webp']);

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
 * failures. See docs/architecture.md, "Why processing is synchronous".
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
  //
  //    Whether this works depends on the libvips build sharp is running against.
  //    The prebuilt binaries ship libheif with the AV1 codec but NO HEVC codec,
  //    and an iPhone HEIC is HEVC-coded. libheif parses the container — so
  //    `metadata()` above succeeds and reports 'heif' — and only fails when the
  //    pixels are actually decoded, here. Verified on 24 July 2026 against a real
  //    HEVC HEIC: "No decoding plugin installed for this compression format".
  //
  //    So this branch converts AVIF, which shares the container, and rejects
  //    the format it was written for. The device-side fix is in place
  //    (`(teacher)/upload.tsx` asks the picker for a compatible representation,
  //    so iOS transcodes before upload); this stays as the server-side backstop
  //    for anything that arrives as HEVC anyway. To make it convert instead of
  //    reject, the deployment needs a libvips built against libheif with
  //    libde265 - see docs/architecture.md, "Where HEIC is actually handled".
  const isHeif = format === 'heif';
  let finalPath = storagePath;
  let mimeType = declaredMimeType;
  let originalBuffer = buffer;

  if (isHeif) {
    try {
      originalBuffer = await sharp(buffer).jpeg({ quality: HEIC_JPEG_QUALITY }).toBuffer();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.warn('HEIF decode failed — libvips has no codec for this variant', {
        storagePath,
        error: detail,
      });
      // Deliberately not the raw libvips text. A teacher needs to know what to
      // do about it, and "bad seek to 80687" tells them nothing.
      throw new Error(
        'This photo is in a format the server cannot read (HEIC). ' +
          'Please re-save it as JPEG and try again.',
      );
    }
    finalPath = storagePath.replace(/\.hei[cf]$/i, '.jpg');
    mimeType = 'image/jpeg';
  }

  const processedMeta = await sharp(originalBuffer).metadata();
  const width = processedMeta.width ?? 0;
  const height = processedMeta.height ?? 0;

  // 3. Original
  await uploadPhotoObject(finalPath, originalBuffer, mimeType);

  // 4. Thumbnail. `withoutEnlargement` avoids upscaling an already-small image.
  //
  // Wrapped so that a failure after the original has landed does not leave the
  // object behind. The caller's cleanup only covers the database-update path,
  // so a thumbnail failure — a truncated file, a CMYK JPEG, an image past
  // libvips' pixel ceiling, a transient storage error — used to orphan a
  // full-resolution original in the bucket that nothing referenced and nothing
  // would ever remove. With retries re-running the whole step, one bad photo
  // could leave several.
  const thumbnailPath = finalPath.replace(/(\.[^.]+)$/, '_thumb.jpg');
  try {
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(THUMBNAIL_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    await uploadPhotoObject(thumbnailPath, thumbnailBuffer, 'image/jpeg');
  } catch (err) {
    await deletePhotoObjects([finalPath]);
    throw err;
  }

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
    converted: isHeif,
  });

  return { storagePath: finalPath, thumbnailPath, mimeType, width, height, blurhash };
}
