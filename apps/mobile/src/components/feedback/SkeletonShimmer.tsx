import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonShimmerProps {
  /** Width of the placeholder. @default '100%' */
  width?: number | string;
  /** Height of the placeholder. @default 20 */
  height?: number | string;
  /** Corner radius. @default 8 */
  borderRadius?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SkeletonShimmer>` — a shimmer loading placeholder.
 *
 * Loops a smooth opacity animation between 0.3 and 1.0 to indicate
 * content is loading. Uses React Native's built-in Animated API.
 *
 * ```tsx
 * <SkeletonShimmer width={200} height={16} borderRadius={4} />
 * ```
 */
export function SkeletonShimmer({
  width = '100%',
  height = 20,
  borderRadius = 8,
}: SkeletonShimmerProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const layoutStyle = { width, height, borderRadius } as ViewStyle;
  return (
    <View style={[styles.base, layoutStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.base, { opacity }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.gray[200],
  },
});

export default SkeletonShimmer;
