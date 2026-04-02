import React, { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, spacing } from '@/theme';
import { shadowMedium } from '@/theme/shadows';

import { HiveImage } from './HiveImage';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolaroidCardProps {
  /** Unique identifier for this photo — used to seed the rotation angle. */
  id: string;
  /** Image URI. */
  uri: string;
  /** Blurhash placeholder string. */
  blurhash?: string;
  /** Optional caption text below the image. */
  caption?: string;
  /** Fires on press. */
  onPress?: () => void;
  /** Fires on long-press. */
  onLongPress?: () => void;
  /** Optional container style overrides. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic rotation angle between -3 and 3 degrees
 * based on a simple hash of the provided `id`.
 */
function seededRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // Normalise to -3..3
  return ((Math.abs(hash) % 700) / 100) - 3;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PolaroidCard>` — a photo card styled like a physical polaroid snapshot.
 *
 * Features:
 * - White border with a larger bottom area for an optional caption.
 * - A subtle deterministic rotation seeded from the photo `id`.
 * - A warm shadow underneath.
 *
 * ```tsx
 * <PolaroidCard
 *   id="abc-123"
 *   uri="https://example.com/photo.jpg"
 *   caption="First day of school!"
 *   onPress={() => openViewer('abc-123')}
 * />
 * ```
 */
export function PolaroidCard({
  id,
  uri,
  blurhash,
  caption,
  onPress,
  onLongPress,
  style,
}: PolaroidCardProps) {
  const rotation = useMemo(() => seededRotation(id), [id]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.container,
        { transform: [{ rotate: `${rotation}deg` }, { scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      <View style={styles.imageWrapper}>
        <HiveImage
          uri={uri}
          blurhash={blurhash}
          style={styles.image}
        />
      </View>

      {caption ? (
        <View style={styles.captionContainer}>
          <Text variant="caption" numberOfLines={2}>
            {caption}
          </Text>
        </View>
      ) : (
        <View style={styles.captionSpacer} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BORDER = spacing.sm;
const BOTTOM_BORDER = spacing.xl;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 4,
    padding: BORDER,
    paddingBottom: 0,
    ...shadowMedium,
  },
  imageWrapper: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  captionContainer: {
    minHeight: BOTTOM_BORDER,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionSpacer: {
    height: BOTTOM_BORDER,
  },
});

export default PolaroidCard;
