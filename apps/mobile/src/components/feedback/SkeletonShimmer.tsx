import React, { useEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  colors,
  radius,
  duration,
  easing,
  timing,
  useReducedMotion,
} from '@/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How long a request may take before a skeleton is worth showing, in ms.
 *
 * Under this, the placeholder is a grey flash: the eye registers a change of
 * state, the content lands, and the screen reads as janky *because* it was
 * fast. Every study of this lands in the 150–250ms band and the app now waits
 * out the whole of it before drawing anything, so a warm cache renders
 * straight to content and only a real wait ever gets a skeleton.
 *
 * The delay lives inside this component rather than at the call site so that
 * every screen already using it — four hand-rolled skeletons at the time of
 * writing — gets the behaviour without being edited.
 */
export const SKELETON_DELAY = 200;

/** One pass of the light band across a block. */
const SWEEP_DURATION = 1400;
/** How far apart in the cycle successive placeholders start. */
const SWEEP_OFFSET = 90;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonShimmerProps {
  /** Width of the placeholder. @default '100%' */
  width?: DimensionValue;
  /** Height of the placeholder. @default 20 */
  height?: DimensionValue;
  /**
   * Corner radius. **Mirror what it is standing in for** — `radius.mount` for a
   * photograph, `radius.lg` for a card — so nothing changes shape when the real
   * content lands. @default radius.xs
   */
  borderRadius?: number;
  /** Position in a group — offsets the sweep so a stack ripples. */
  index?: number;
  /**
   * Overrides the wait before the placeholder appears, in ms. Pass `0` inside a
   * surface that has already served its own delay — a skeleton revealed by a
   * button press, say. @default 200
   */
  delay?: number;
}

export interface SkeletonSwapProps {
  /**
   * Whether the real content is still on its way. Pass the **first-load** flag
   * — React Query's `isLoading`, not `isFetching`. A refetch has content on
   * screen already, and replacing it with grey blocks to refresh it is worse
   * than the wait.
   */
  loading: boolean;
  /**
   * The placeholder. Build it from `SkeletonShimmer` blocks **in the shape of
   * the content it replaces** — same heights, same gaps, same radii — or the
   * swap reflows and undoes the point of having one.
   */
  skeleton: ReactNode;
  /** Extra style for the container that holds both states. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// SkeletonShimmer
// ---------------------------------------------------------------------------

/**
 * `<SkeletonShimmer>` — a loading placeholder that waits its turn.
 *
 * Two things make it behave: it does not appear for the first
 * {@link SKELETON_DELAY} milliseconds, and a band of light sweeps across the
 * block rather than the whole block pulsing. A pulse says "something is broken
 * and blinking"; a sweep says "this is arriving", which is the only thing a
 * skeleton has to communicate. Pass `index` so a stack of them ripples in
 * sequence.
 *
 * Under Reduce Motion the sweep is dropped and the block simply appears, still
 * after the delay — the delay is a timing decision about flashing, not an
 * animation, so it survives.
 *
 * Nothing is announced to a screen reader until the block is actually visible.
 * Announcing "Loading" for a request that resolves in 80ms is the audible
 * version of the grey flash.
 *
 * ```tsx
 * <SkeletonShimmer width="100%" height={180} borderRadius={radius.mount} index={0} />
 * ```
 */
export function SkeletonShimmer({
  width = '100%',
  height = 20,
  borderRadius = radius.xs,
  index = 0,
  delay = SKELETON_DELAY,
}: SkeletonShimmerProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const appear = useSharedValue(0);

  /** Mirrors `appear` on the JS side, for the accessibility label only. */
  const [announced, setAnnounced] = useState(delay <= 0);

  useEffect(() => {
    // Springs move things, timings colour them — this is opacity, so it is a
    // timing. `timing()` carries ReduceMotion.System, which finishes the fade
    // instantly on a device that asks for it while leaving the delay intact.
    appear.value = withDelay(delay, withTiming(1, timing(duration.fast)));

    const announce = setTimeout(() => setAnnounced(true), delay);
    return () => clearTimeout(announce);
  }, [appear, delay]);

  useEffect(() => {
    if (reduced) return;
    progress.value = 0;
    // Linear, because the sine in `sweepStyle` is already the easing: running
    // the ramp through a quad as well eased it twice and put a flat spot at
    // each end of the sweep. `easing.linear` is the theme's own token for
    // exactly this — continuous loops, shimmer and pulse.
    //
    // Written as a config rather than through `timing()` because that helper's
    // curve parameter is typed to the factories `Easing.bezier()` returns, and
    // `Easing.linear` is a plain easing function. No `reduceMotion` flag is
    // needed: the effect above has already returned on such a device, so the
    // loop never starts.
    progress.value = withRepeat(
      withTiming(1, {
        duration: SWEEP_DURATION + (index % 4) * SWEEP_OFFSET,
        easing: easing.linear,
      }),
      -1,
      false,
    );
  }, [reduced, index, progress]);

  const appearStyle = useAnimatedStyle(() => ({ opacity: appear.value }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + Math.sin(progress.value * Math.PI) * 0.45,
  }));

  const layoutStyle: ViewStyle = { width, height, borderRadius };

  return (
    <Animated.View
      accessible={announced}
      accessibilityLabel={announced ? 'Loading' : undefined}
      style={[styles.base, layoutStyle, appearStyle]}
    >
      {!reduced && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.sweep, { borderRadius }, sweepStyle]}
        />
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// SkeletonSwap
// ---------------------------------------------------------------------------

/**
 * `<SkeletonSwap>` — holds the placeholder and the content, and hands over
 * between them.
 *
 * The skeleton sits in the flow while the request is out, so it is what gives
 * the region its height; the moment the content arrives it takes over the flow
 * and the skeleton is lifted onto an overlay and faded out over
 * `duration.fast`. Both are on screen for that fifth of a second, which is what
 * makes it read as a dissolve rather than as a cut — and because the content is
 * already laid out underneath, nothing moves.
 *
 * The delay before anything appears is the shimmer's own, so a swap whose
 * request resolves in 90ms shows a container of invisible blocks and then the
 * content, with no flash between them.
 *
 * ```tsx
 * <SkeletonSwap loading={isLoading} skeleton={<FeedSkeleton />}>
 *   <FeedList photos={photos} />
 * </SkeletonSwap>
 * ```
 */
export function SkeletonSwap({
  loading,
  skeleton,
  style,
  children,
}: SkeletonSwapProps) {
  /** Kept mounted for the length of the dissolve after `loading` goes false. */
  const [mounted, setMounted] = useState(loading);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (loading) {
      setMounted(true);
      fade.value = 1;
      return;
    }

    fade.value = withTiming(0, timing(duration.fast));
    const unmount = setTimeout(() => setMounted(false), duration.fast);
    return () => clearTimeout(unmount);
  }, [loading, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={style}>
      {!loading && children}

      {mounted && (
        <Animated.View
          style={[!loading && styles.overlay, fadeStyle]}
          pointerEvents="none"
        >
          {skeleton}
        </Animated.View>
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
  /** Only while dissolving — until then the skeleton owns the layout. */
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default SkeletonShimmer;
