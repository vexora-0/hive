import React, { useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Badge } from '@/components/ui';
import { Text } from '@/components/ui';
import { UploadProgress } from './UploadProgress';
import type { UploadImage, ImageUploadState } from '@/features/teacher/hooks/useUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadPreviewProps {
  /** Array of images with their upload states. */
  images: UploadImage[];
  /** Remove an image from the selection (only when idle). */
  onRemove: (id: string) => void;
  /** Retry a failed image. */
  onRetry?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATE_BADGE_VARIANT: Record<
  ImageUploadState,
  'default' | 'success' | 'warning' | 'error'
> = {
  idle: 'default',
  hashing: 'warning',
  'requesting-url': 'warning',
  uploading: 'warning',
  saving: 'warning',
  tagging: 'warning',
  complete: 'success',
  error: 'error',
};

const STATE_BADGE_LABEL: Record<ImageUploadState, string> = {
  idle: 'Ready',
  hashing: 'Hashing',
  'requesting-url': 'Preparing',
  uploading: 'Uploading',
  saving: 'Saving',
  tagging: 'Tagging',
  complete: 'Done',
  error: 'Error',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<UploadPreview>` -- horizontal ScrollView of selected images.
 *
 * Each image card shows:
 * - A thumbnail preview
 * - A state badge (hashing / uploading / complete / error)
 * - A honeycomb-styled progress bar (amber coloured)
 * - A remove button (X) when the image is idle
 */
export function UploadPreview({
  images,
  onRemove,
  onRetry,
}: UploadPreviewProps) {
  if (images.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text
        variant="bodySmallBold"
        color={colors.text.secondary}
        style={styles.heading}
      >
        Selected Photos ({images.length})
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((image) => (
          <PreviewCard
            key={image.id}
            image={image}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PreviewCard (per-image)
// ---------------------------------------------------------------------------

interface PreviewCardProps {
  image: UploadImage;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

function PreviewCard({ image, onRemove, onRetry }: PreviewCardProps) {
  const isIdle = image.state === 'idle';
  const badgeVariant = STATE_BADGE_VARIANT[image.state];
  const badgeLabel = STATE_BADGE_LABEL[image.state];

  const handleRemove = useCallback(() => {
    onRemove(image.id);
  }, [image.id, onRemove]);

  const handleRetry = useCallback(() => {
    onRetry?.(image.id);
  }, [image.id, onRetry]);

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.thumbnailWrapper}>
        <Image source={{ uri: image.uri }} style={styles.thumbnail} />

        {/* Remove button (only when idle) */}
        {isIdle && (
          <Pressable
            onPress={handleRemove}
            style={styles.removeButton}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${image.filename}`}
          >
            <Ionicons name="close-circle" size={22} color={colors.white} />
          </Pressable>
        )}

        {/* State badge overlay */}
        {!isIdle && (
          <View style={styles.badgeOverlay}>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </View>
        )}
      </View>

      {/* Progress */}
      <UploadProgress
        state={image.state}
        progress={image.progress}
        error={image.error}
        onRetry={image.state === 'error' ? handleRetry : undefined}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_WIDTH = 130;
const THUMBNAIL_SIZE = 110;

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.sm,
  },
  heading: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.background.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.sm,
  },
  thumbnailWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: layout.cardRadius - spacing.xs,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.overlay.medium,
    borderRadius: 11,
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
});

export default UploadPreview;
