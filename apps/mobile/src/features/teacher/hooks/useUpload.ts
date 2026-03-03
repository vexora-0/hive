import { useCallback, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { v4 as uuidv4 } from 'uuid';

import { retryWithBackoff } from '@/utils/retry';
import { logger } from '@/utils/logger';
import { MAX_UPLOAD_IMAGES } from '@/theme';
import {
  requestUploadUrl,
  uploadPhotoFile,
  tagStudents,
} from '@/features/teacher/services/teacherService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageUploadState =
  | 'idle'
  | 'requesting-url'
  | 'uploading'
  | 'saving'
  | 'tagging'
  | 'complete'
  | 'error';

export interface UploadImage {
  /** Internal tracking id. */
  id: string;
  /** Local file URI. */
  uri: string;
  /** Filename derived from URI. */
  filename: string;
  /** MIME type. */
  contentType: string;
  /** File size in bytes. */
  fileSize: number;
  /** Current upload pipeline state. */
  state: ImageUploadState;
  /** Upload progress 0-1. */
  progress: number;
  /** Error message if state is 'error'. */
  error?: string;
  /** Server-assigned photo id after requesting upload URL. */
  photoId?: string;
  /** S3 object key after requesting upload URL. */
  s3Key?: string;
}

export interface UseUploadReturn {
  /** All images currently tracked by the upload pipeline. */
  images: UploadImage[];
  /** Add images picked by the user. Returns the count actually added. */
  addImages: (assets: PickedAsset[]) => number;
  /** Remove an image by its tracking id. Only allowed when idle. */
  removeImage: (id: string) => void;
  /** Start the upload pipeline for all idle images. */
  startUpload: (classId: string, studentIds: string[]) => Promise<void>;
  /** Retry a single failed image. */
  retryImage: (id: string, classId: string, studentIds: string[]) => Promise<void>;
  /** Overall progress 0-1 across all images. */
  overallProgress: number;
  /** Whether any image is currently uploading. */
  isUploading: boolean;
  /** Whether all images have completed. */
  isComplete: boolean;
  /** Whether confetti should be shown (true once all complete). */
  showConfetti: boolean;
  /** Dismiss confetti. */
  dismissConfetti: () => void;
  /** Reset the entire upload pipeline. */
  resetUpload: () => void;
}

export interface PickedAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

// ---------------------------------------------------------------------------
// Retry config: 1s -> 2s -> 4s, max 3 attempts
// ---------------------------------------------------------------------------

const RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filenameFromUri(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? `photo_${Date.now()}.jpg`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useUpload` -- manages the full image upload pipeline as a state machine.
 *
 * Each image progresses through:
 *   idle -> hashing -> requesting-url -> uploading -> saving -> tagging -> complete
 *
 * Errors at any step transition the image to 'error' with a message.
 * The hook tracks overall progress and triggers confetti on completion.
 */
export function useUpload(): UseUploadReturn {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Ref to track if upload is in progress (avoid stale closures)
  const isUploadingRef = useRef(false);

  // ── Image mutation helpers ──────────────────────────────────────────

  const updateImage = useCallback(
    (id: string, patch: Partial<UploadImage>) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
      );
    },
    [],
  );

  // ── Add images ──────────────────────────────────────────────────────

  const addImages = useCallback(
    (assets: PickedAsset[]): number => {
      setImages((prev) => {
        const remaining = MAX_UPLOAD_IMAGES - prev.length;
        const toAdd = assets.slice(0, remaining);

        const newImages: UploadImage[] = toAdd.map((asset) => ({
          id: uuidv4(),
          uri: asset.uri,
          filename: asset.fileName ?? filenameFromUri(asset.uri),
          contentType: asset.mimeType ?? 'image/jpeg',
          fileSize: asset.fileSize ?? 0,
          state: 'idle' as const,
          progress: 0,
        }));

        return [...prev, ...newImages];
      });

      return Math.min(assets.length, MAX_UPLOAD_IMAGES - images.length);
    },
    [images.length],
  );

  // ── Remove image ────────────────────────────────────────────────────

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  // ── Single image upload pipeline ────────────────────────────────────

  const processImage = useCallback(
    async (image: UploadImage, classId: string, studentIds: string[]) => {
      const { id, uri, filename, contentType, fileSize } = image;

      try {
        // Step 1: Request photo slot
        updateImage(id, { state: 'requesting-url', progress: 0.1 });
        const { photoId, uploadUrl, s3Key } = await retryWithBackoff(
          () =>
            requestUploadUrl({
              classId,
              filename,
              contentType,
              fileSize,
            }),
          RETRY_OPTIONS,
        );
        updateImage(id, { photoId, s3Key, progress: 0.3 });

        // Step 3: Upload file to backend (saves + confirms in one step)
        updateImage(id, { state: 'uploading', progress: 0.35 });
        await retryWithBackoff(
          () => uploadPhotoFile(photoId, uri, contentType, filename),
          RETRY_OPTIONS,
        );
        updateImage(id, { state: 'saving', progress: 0.85 });

        // Step 5: Tag students (skip if none selected)
        if (studentIds.length > 0) {
          updateImage(id, { state: 'tagging', progress: 0.9 });
          await retryWithBackoff(
            () => tagStudents(photoId, studentIds),
            RETRY_OPTIONS,
          );
        }

        // Done
        updateImage(id, { state: 'complete', progress: 1 });
        logger.info(`Upload complete for image ${id} (photo: ${photoId})`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        logger.error(`Upload failed for image ${id}:`, err);
        updateImage(id, { state: 'error', error: message });
      }
    },
    [updateImage],
  );

  // ── Start upload for all idle images ────────────────────────────────

  const startUpload = useCallback(
    async (classId: string, studentIds: string[]) => {
      isUploadingRef.current = true;
      setShowConfetti(false);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Grab current idle images
      const idleImages = images.filter((img) => img.state === 'idle');
      if (idleImages.length === 0) return;

      // Process all images concurrently
      await Promise.allSettled(
        idleImages.map((img) => processImage(img, classId, studentIds)),
      );

      isUploadingRef.current = false;

      // Check if all images completed
      setImages((current) => {
        const allComplete = current.every((img) => img.state === 'complete');
        if (allComplete && current.length > 0) {
          setShowConfetti(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return current;
      });
    },
    [images, processImage],
  );

  // ── Retry a single image ────────────────────────────────────────────

  const retryImage = useCallback(
    async (id: string, classId: string, studentIds: string[]) => {
      const image = images.find((img) => img.id === id);
      if (!image || image.state !== 'error') return;

      // Reset image state to idle then process
      updateImage(id, { state: 'idle', progress: 0, error: undefined });

      // Re-read the image after state update
      const resetImage: UploadImage = {
        ...image,
        state: 'idle',
        progress: 0,
        error: undefined,
      };

      await processImage(resetImage, classId, studentIds);

      // Check completion after retry
      setImages((current) => {
        const allComplete = current.every((img) => img.state === 'complete');
        if (allComplete && current.length > 0) {
          setShowConfetti(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return current;
      });
    },
    [images, processImage, updateImage],
  );

  // ── Dismiss confetti ────────────────────────────────────────────────

  const dismissConfetti = useCallback(() => {
    setShowConfetti(false);
  }, []);

  // ── Reset ───────────────────────────────────────────────────────────

  const resetUpload = useCallback(() => {
    setImages([]);
    setShowConfetti(false);
    isUploadingRef.current = false;
  }, []);

  // ── Derived state ───────────────────────────────────────────────────

  const overallProgress = useMemo(() => {
    if (images.length === 0) return 0;
    const total = images.reduce((sum, img) => sum + img.progress, 0);
    return total / images.length;
  }, [images]);

  const isUploading = useMemo(
    () => images.some((img) =>
      img.state !== 'idle' &&
      img.state !== 'complete' &&
      img.state !== 'error',
    ),
    [images],
  );

  const isComplete = useMemo(
    () => images.length > 0 && images.every((img) => img.state === 'complete'),
    [images],
  );

  return {
    images,
    addImages,
    removeImage,
    startUpload,
    retryImage,
    overallProgress,
    isUploading,
    isComplete,
    showConfetti,
    dismissConfetti,
    resetUpload,
  };
}
