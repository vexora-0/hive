import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  spring,
  pressScale,
} from '@/theme';

import { HiveImage } from './HiveImage';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoMountProps {
  /** Photo id — seeds the deterministic aspect ratio. */
  id: string;
  /** Image URI. */
  uri: string;
  /** Blurhash placeholder. */
  blurhash?: string;
  /** Caption printed in the mount's bottom margin. */
  caption?: string;
  /**
   * Marks the print as recent with a folded marigold corner. Reserve it for
   * something a parent actually needs to spot — photos they have not seen.
   */
  isNew?: boolean;
  /** Forces a specific aspect ratio instead of the seeded one. */
  aspectRatio?: number;
  /** Fires on press. */
  onPress?: () => void;
  /** Fires on long press. */
  onLongPress?: () => void;
  /** Accessibility label. Defaults to the caption. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Aspect ratios
// ---------------------------------------------------------------------------

/**
 * Print sizes, not arbitrary crops: a square, a 4:5 portrait and a 3:4. Seeding
 * from the id means a photo keeps its shape between renders and between
 * sessions, so the wall does not reshuffle every time the feed refetches.
 */
const PRINT_RATIOS = [1, 0.8, 0.75] as const;

function seededRatio(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return PRINT_RATIOS[Math.abs(hash) % PRINT_RATIOS.length];
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** The mat around the print. */
const MAT = spacing.sm;
/** The deeper margin below it, where the caption is printed. */
const MAT_BOTTOM = spacing.md;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PhotoMount>` — a photograph mounted on paper. The app's signature object.
 *
 * A white mat with square-ish corners, an even margin on three sides and a
 * deeper one below, where the caption is printed. That uneven margin is the
 * whole trick: it is how a framed print is cut, and it is what stops the feed
 * reading as a grid of app cards.
 *
 * It replaces the previous polaroid card, which tilted each photo by a random
 * few degrees. A child's photograph should not arrive crooked.
 *
 * ```tsx
 * <PhotoMount id={p.id} uri={p.uri} caption="by Meera ma'am" isNew onPress={open} />
 * ```
 */
export function PhotoMount({
  id,
  uri,
  blurhash,
  caption,
  isNew = false,
  aspectRatio,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}: PhotoMountProps) {
  const ratio = useMemo(
    () => aspectRatio ?? seededRatio(id),
    [aspectRatio, id],
  );

  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.card, spring.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const body = (
    <>
      <View style={styles.window}>
        <HiveImage
          uri={uri}
          blurhash={blurhash}
          style={[styles.image, { aspectRatio: ratio }]}
        />
      </View>

      <View style={styles.margin}>
        {caption ? (
          <Text variant="caption" muted numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>

      {isNew && (
        <>
          <View style={styles.foldShadow} />
          <View style={styles.fold} />
        </>
      )}
    </>
  );

  if (!onPress && !onLongPress) {
    return <View style={[styles.mount, style]}>{body}</View>;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel ?? caption ?? 'Photo'}
      style={[styles.mount, animatedStyle, style]}
    >
      {body}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FOLD = 18;

const styles = StyleSheet.create({
  mount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: MAT,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  window: {
    borderRadius: radius.print,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
  },
  image: {
    width: '100%',
  },
  margin: {
    minHeight: MAT_BOTTOM,
    paddingTop: spacing.sm,
    paddingBottom: MAT_BOTTOM - spacing.xs,
    justifyContent: 'center',
  },
  /**
   * The folded corner. Two stacked triangles built from borders: a soft one
   * for the crease shadow and the marigold face on top.
   */
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: FOLD,
    borderLeftWidth: FOLD,
    borderTopColor: colors.primary.amber,
    borderLeftColor: colors.transparent,
    borderTopRightRadius: radius.mount,
  },
  foldShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: FOLD + 2,
    borderLeftWidth: FOLD + 2,
    borderTopColor: colors.primary.amberLight,
    borderLeftColor: colors.transparent,
    borderTopRightRadius: radius.mount,
  },
});

export default PhotoMount;
