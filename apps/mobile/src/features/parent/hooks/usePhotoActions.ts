import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { logger } from '@/utils/logger';
import type { FeedPhoto } from '../services/parentService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhotoAction = 'viewFullScreen' | 'addToCart' | 'downloadPhoto';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `usePhotoActions` -- manages photo selection state and handles actions
 * from the photo action sheet.
 *
 * Actions:
 * - **viewFullScreen**: navigates to the full-screen photo viewer.
 * - **addToCart**: navigates to the order flow with the photo pre-selected.
 * - **downloadPhoto**: placeholder for future implementation.
 */
export function usePhotoActions() {
  const router = useRouter();
  const [selectedPhoto, setSelectedPhoto] = useState<FeedPhoto | null>(null);

  const clearSelectedPhoto = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  const handleAction = useCallback(
    async (action: PhotoAction, photo: FeedPhoto) => {
      // Provide haptic feedback for all actions.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      switch (action) {
        case 'viewFullScreen': {
          logger.debug('usePhotoActions: viewFullScreen', { photoId: photo.id });
          clearSelectedPhoto();
          router.push(`/(parent)/photo/${photo.id}` as never);
          break;
        }

        case 'addToCart': {
          logger.debug('usePhotoActions: addToCart', { photoId: photo.id });
          clearSelectedPhoto();
          // Navigate to the order flow with this photo pre-selected.
          // The orders feature will be built in Phase 9; for now we
          // navigate to the orders tab with a param.
          router.push({
            pathname: '/(parent)/orders' as never,
            params: { photoId: photo.id },
          } as never);
          break;
        }

        case 'downloadPhoto': {
          logger.info('usePhotoActions: downloadPhoto -- not yet implemented');
          clearSelectedPhoto();
          // Placeholder: download will be implemented in a future phase.
          break;
        }

        default: {
          logger.warn('usePhotoActions: unknown action', { action });
          break;
        }
      }
    },
    [router, clearSelectedPhoto],
  );

  return {
    selectedPhoto,
    setSelectedPhoto,
    clearSelectedPhoto,
    handleAction,
  };
}
