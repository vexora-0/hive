import { Queue, Worker, Job } from 'bullmq';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Bucket } from '../config/s3';
import { redisConnection } from '../config/redis';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

const QUEUE_NAME = 'image-processing';
const THUMBNAIL_WIDTH = 400;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

interface ImageProcessingData {
  photoId: string;
  s3Key: string;
}

export const imageProcessingQueue = new Queue<ImageProcessingData>(
  QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
);

async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;

  if (!stream) {
    throw new Error(`Empty response body for S3 key: ${key}`);
  }

  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function uploadToS3(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

function computeBlurhash(
  pixels: Buffer,
  width: number,
  height: number,
): string {
  return encode(
    new Uint8ClampedArray(pixels),
    width,
    height,
    BLURHASH_COMPONENT_X,
    BLURHASH_COMPONENT_Y,
  );
}

async function processImage(job: Job<ImageProcessingData>): Promise<void> {
  const { photoId, s3Key } = job.data;

  logger.info('Starting image processing', { photoId, s3Key, jobId: job.id });

  try {
    // 1. Download original from S3
    const originalBuffer = await downloadFromS3(s3Key);

    await job.updateProgress(20);

    // 2. Process with sharp: HEIC->JPEG conversion if needed, get metadata
    let image = sharp(originalBuffer);
    const metadata = await image.metadata();

    const format = metadata.format as string | undefined;
    const isHeic =
      s3Key.toLowerCase().endsWith('.heic') ||
      format === 'heif' ||
      format === 'heic';

    // Convert HEIC to JPEG
    if (isHeic) {
      image = image.jpeg({ quality: 90 });
    }

    // Get the dimensions of the processed image
    const processedBuffer = await image.toBuffer();
    const processedMeta = await sharp(processedBuffer).metadata();
    const width = processedMeta.width ?? 0;
    const height = processedMeta.height ?? 0;

    // If HEIC was converted, re-upload the JPEG version
    if (isHeic) {
      const jpegKey = s3Key.replace(/\.heic$/i, '.jpg');
      await uploadToS3(jpegKey, processedBuffer, 'image/jpeg');

      // Update the s3_key to the new JPEG key
      await supabaseAdmin
        .from('photos')
        .update({
          s3_key: jpegKey,
          content_type: 'image/jpeg',
        })
        .eq('id', photoId);
    }

    await job.updateProgress(50);

    // 3. Generate thumbnail (400px wide, maintaining aspect ratio)
    const thumbnailBuffer = await sharp(processedBuffer)
      .resize(THUMBNAIL_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailKey = s3Key.replace(
      /(\.[^.]+)$/,
      '_thumb.jpg',
    );

    await uploadToS3(thumbnailKey, thumbnailBuffer, 'image/jpeg');

    await job.updateProgress(75);

    // 4. Compute blurhash from a small version of the image
    const blurhashSize = 32;
    const blurhashImage = await sharp(processedBuffer)
      .resize(blurhashSize, blurhashSize, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const blurhash = computeBlurhash(
      blurhashImage,
      blurhashSize,
      blurhashSize,
    );

    await job.updateProgress(90);

    // 5. Update photo record
    const { error: updateError } = await supabaseAdmin
      .from('photos')
      .update({
        status: 'ready',
        blurhash,
        thumbnail_s3_key: thumbnailKey,
        width,
        height,
        processed_at: new Date().toISOString(),
      })
      .eq('id', photoId);

    if (updateError) {
      throw new Error(
        `Failed to update photo record: ${updateError.message}`,
      );
    }

    await job.updateProgress(100);

    logger.info('Image processing complete', {
      photoId,
      width,
      height,
      thumbnailKey,
      jobId: job.id,
    });
  } catch (err) {
    logger.error('Image processing failed', {
      photoId,
      s3Key,
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    });

    // Update photo status to 'failed' on final attempt
    if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
      await supabaseAdmin
        .from('photos')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', photoId);
    }

    throw err;
  }
}

// Create and export the worker
export function startImageProcessingWorker(): Worker<ImageProcessingData> {
  const worker = new Worker<ImageProcessingData>(
    QUEUE_NAME,
    processImage,
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info('Image processing job completed', {
      jobId: job.id,
      photoId: job.data.photoId,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Image processing job failed', {
      jobId: job?.id,
      photoId: job?.data.photoId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Image processing worker error', {
      error: err.message,
    });
  });

  logger.info('Image processing worker started');

  return worker;
}
