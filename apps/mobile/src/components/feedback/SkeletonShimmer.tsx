import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, useReducedMotion } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonShimmerProps {
  /** Width of the placeholder. @default '100%' */
  width?: DimensionValue;
  /** Height of the placeholder. @default 20 */
  height?: DimensionValue;
  /** Corner radius. @default radius.xs */
  borderRadius?: number;
  /** Position in a group — offsets the sweep so a stack ripples. */
  index?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWEEP_DURATION = 1400;
/** How far apart in the cycle successive placeholders start. */
const SWEEP_OFFSET = 90;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SkeletonShimmer>` — a loading placeholder.
 *
 * A band of light sweeps across the block rather than the whole block pulsing.
 * A pulse says "something is broken and blinking"; a sweep says "this is
 * arriving", which is the only thing a skeleton has to communicate. Pass
 * `index` so a stack of them ripples in sequence.
 *
 * Under Reduce Motion the sweep is dropped and a flat block is shown.
 *
 * ```tsx
 * <SkeletonShimmer width={180} height={14} index={2} />
 * ```
 */
export function SkeletonShimmer({
  width = '100%',
  height = 20,
  borderRadius = radius.xs,
  index = 0,
}: SkeletonShimmerProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: SWEEP_DURATION + (index % 4) * SWEEP_OFFSET,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );
  }, [reduced, index, progress]);

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + Math.sin(progress.value * Math.PI) * 0.45,
  }));

  const layoutStyle: ViewStyle = { width, height, borderRadius };

  return (
    <View
      accessible
      accessibilityLabel="Loading"
      style={[styles.base, layoutStyle]}
    >
      {!reduced && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.sweep, { borderRadius }, sweepStyle]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.surfaceSecondary,
    overflow: 'hidden',
  },
  sweep: {
    backgroundColor: colors.gray[200],
  },
});

export default SkeletonShimmer;
