import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { spring, duration, timing, stagger, travel, useReducedMotion } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevealProps {
  children: React.ReactNode;
  /**
   * Position in a staggered group. Item 0 arrives first; the delay is capped
   * so the tail of a long list does not queue up behind the head.
   */
  index?: number;
  /** Extra delay before this element's own stagger, in ms. */
  delay?: number;
  /** Distance travelled before settling. Defaults to `travel.rise` (14px). */
  distance?: number;
  /** Which way the element comes from. @default 'up' */
  from?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Adds a slight scale-up to the entrance — for hero elements only. */
  scale?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Reveal>` — the app's single entrance animation.
 *
 * Everything that appears on a screen arrives the same way: a short rise and
 * a fade, springs for the movement and a timing curve for the opacity, so a
 * list reads as one gesture instead of fifteen. Pass `index` for the stagger.
 *
 * Under Reduce Motion the element is simply there — no fade, no travel.
 *
 * ```tsx
 * {photos.map((p, i) => (
 *   <Reveal key={p.id} index={i}>
 *     <PhotoMount {...p} />
 *   </Reveal>
 * ))}
 * ```
 */
export function Reveal({
  children,
  index = 0,
  delay = 0,
  distance = travel.rise,
  from = 'up',
  scale = false,
  style,
}: RevealProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      opacity.value = 1;
      return;
    }
    const wait = delay + stagger(index);
    progress.value = withDelay(wait, withSpring(1, spring.gentle));
    opacity.value = withDelay(wait, withTiming(1, timing(duration.slow)));
  }, [reduced, delay, index, progress, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    const offset = (1 - progress.value) * distance;

    // Built as literals rather than pushed into an array: React Native types
    // `transform` as a readonly union, so a mutable accumulator does not fit.
    const travelTransform =
      from === 'up'
        ? [{ translateY: offset }]
        : from === 'down'
          ? [{ translateY: -offset }]
          : from === 'left'
            ? [{ translateX: offset }]
            : from === 'right'
              ? [{ translateX: -offset }]
              : [];

    const scaleTransform = scale
      ? [{ scale: 0.96 + progress.value * 0.04 }]
      : [];

    return {
      opacity: opacity.value,
      transform: [...travelTransform, ...scaleTransform],
    };
  });

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

export default Reveal;
