import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  spacing,
  radius,
  duration,
  spring,
  timing,
  exitTiming,
  withAlpha,
  useReducedMotion,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { SKELETON_DELAY } from '@/components/feedback/SkeletonShimmer';

import { HiveImage } from './HiveImage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewerPhoto {
  /** Stable id. Keys the page and the image's recycling. */
  id?: string;
  /**
   * **The original, never the thumbnail.** The feed deliberately hands
   * `thumbnailUri` to `<PhotoMount>` because a 2-up wall does not need the full
   * file; a full-screen viewer does, and serving the thumbnail here is the one
   * mistake a keepsake app cannot make.
   */
  uri: string;
  /** Blurhash placeholder. */
  blurhash?: string;
  /** One quiet line printed over the foot of the photograph. */
  caption?: string;
}

export interface PhotoViewerProps {
  /** Single-photo form. Ignored when `photos` is given. */
  uri?: string;
  /** Blurhash for the single-photo form. */
  blurhash?: string;
  /** Caption for the single-photo form. */
  caption?: string;

  /**
   * Gallery form — the photos this viewer may page between, in the order they
   * are shown in the feed. Pass a parent's whole day and they can swipe through
   * it without going back to the wall between photographs.
   */
  photos?: ViewerPhoto[];
  /**
   * Which photo to open on. **Uncontrolled**: it is the starting page, not a
   * value the viewer tracks. Paging afterwards is reported through
   * `onIndexChange` and owned in here, so a parent that mirrors it back into
   * this prop will not fight the gesture.
   * @default 0
   */
  index?: number;
  /** Fires when the user pages to another photo. */
  onIndexChange?: (index: number) => void;

  /** Called when the user requests to close the viewer. */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/** Dead space between two photographs while paging. */
const PAGE_GUTTER = spacing.lg;
/** How far across a page a swipe must travel to turn it. */
const PAGE_THRESHOLD = 0.22;
/** …or how fast, in px/s, if it does not travel that far. */
const PAGE_VELOCITY = 520;
/** How much a drag past the first or last photograph actually moves. */
const EDGE_RESISTANCE = 0.3;

/** Fraction of the screen height a downward drag covers to fully dismiss. */
const DISMISS_RANGE = 0.32;
/** …and the flick that dismisses without covering it, in px/s. */
const DISMISS_VELOCITY = 900;
/** How far down the drag must have got by the time the finger lifts. */
const DISMISS_DISTANCE = 110;

/** Before the axis is decided, in px — below this a drag is still ambiguous. */
const AXIS_SLOP = 3;

/** One breath of the loading plate. Ambient, and nobody is timing it. */
const PLATE_SWEEP = duration.deliberate * 2;

const A11Y_PAGE_ACTIONS = [
  { name: 'increment', label: 'Next photo' },
  { name: 'decrement', label: 'Previous photo' },
];

function clampTo(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PhotoViewer>` — the photograph, full screen, and nothing else.
 *
 * The ground is `colors.viewer.ground` (`#0B0B0C`) rather than `ink.900`. Ink
 * measures C\*7.5 — a violet cast wide enough to shift the apparent white
 * balance of whatever sits inside it, which is exactly the thing a viewer must
 * not do to a photograph. Near-neutral, and not pure black either: black
 * against a warm photograph reads as a hole rather than as a surround.
 *
 * It handles four gestures:
 *
 *  - **Pinch** to zoom, about the point between the fingers, to 4×.
 *  - **Double-tap** to jump to 2.5× on the tapped detail, and back.
 *  - **Pan** to move around a zoomed photograph, clamped to its real edges —
 *    it knows the photo's intrinsic size once it has loaded, so a landscape
 *    shot cannot be dragged off into the black.
 *  - **Swipe down** to dismiss, and **swipe sideways** to page, when there is
 *    more than one photograph and the zoom is at rest.
 *
 * Loading is deliberately not a spinner. A blurhash stands in when there is
 * one; when there is not, an empty plate the size of a print appears after
 * 200ms, breathing gently. A spinner on black tells a parent the app is busy;
 * a plate tells them a photograph is on its way and roughly how big it is.
 *
 * ```tsx
 * // one photograph — unchanged from the original API
 * <PhotoViewer uri={photo.uri} blurhash={photo.blurhash} onClose={goBack} />
 *
 * // a day of them
 * <PhotoViewer photos={day} index={tapped} onIndexChange={setTapped} onClose={goBack} />
 * ```
 */
export function PhotoViewer({
  uri,
  blurhash,
  caption,
  photos,
  index = 0,
  onIndexChange,
  onClose,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();

  /** The single-photo form is just a gallery of one. */
  const pages = useMemo<ViewerPhoto[]>(() => {
    if (photos && photos.length > 0) return photos;
    return uri ? [{ uri, blurhash, caption }] : [];
  }, [photos, uri, blurhash, caption]);

  const count = pages.length;
  const pageWidth = windowW + PAGE_GUTTER;

  const initialIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const [page, setPage] = useState(initialIndex);

  // ── Shared values ──────────────────────────────────────────────────
  // Zoom and pan belong to whichever photograph is on screen; paging and
  // dismissal belong to the stage that carries all of them.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pageX = useSharedValue(-initialIndex * pageWidth);
  const pageIndex = useSharedValue(initialIndex);
  const startPageX = useSharedValue(0);
  /** 0 undecided · 1 paging · 2 dismissing. */
  const axis = useSharedValue(0);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  /** The photo's on-screen size at 1×, once it has told us its proportions. */
  const fitW = useSharedValue(windowW);
  const fitH = useSharedValue(windowH);

  // ── Close ──────────────────────────────────────────────────────────
  // Guarded: the dismiss animation's completion callback and a tap on the
  // close button can both arrive, and a screen must not be popped twice.
  const closed = useRef(false);
  const handleClose = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose?.();
  }, [onClose]);

  // ── Paging ─────────────────────────────────────────────────────────
  const resetZoom = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    fitW.value = windowW;
    fitH.value = windowH;
  }, [scale, savedScale, tx, ty, savedTx, savedTy, fitW, fitH, windowW, windowH]);

  /** Called from the gesture once a page turn has been decided. */
  const commitPage = useCallback(
    (next: number) => {
      setPage(next);
      resetZoom();
      onIndexChange?.(next);
    },
    [resetZoom, onIndexChange],
  );

  /** The programmatic route in — the accessibility actions use it. */
  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), count - 1);
      if (clamped === pageIndex.value) return;
      pageIndex.value = clamped;
      pageX.value = withSpring(-clamped * pageWidth, spring.snappy);
      commitPage(clamped);
    },
    [count, pageWidth, pageIndex, pageX, commitPage],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      goToPage(
        event.nativeEvent.actionName === 'increment' ? page + 1 : page - 1,
      );
    },
    [goToPage, page],
  );

  // Re-seats the track when the window changes size — a rotation, a foldable,
  // a web browser being dragged. Deliberately keyed on the width alone: on a
  // page turn the spring is already driving `pageX`, and re-running this would
  // cut it short mid-flight.
  useEffect(() => {
    pageX.value = -pageIndex.value * pageWidth;
  }, [pageWidth, pageX, pageIndex]);

  const reportIntrinsicSize = useCallback(
    (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const fit = Math.min(windowW / w, windowH / h);
      fitW.value = w * fit;
      fitH.value = h * fit;
    },
    [windowW, windowH, fitW, fitH],
  );

  // ── Gestures ───────────────────────────────────────────────────────

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      focalX.value = event.focalX - windowW / 2;
      focalY.value = event.focalY - windowH / 2;
    })
    .onUpdate((event) => {
      const next = clampTo(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      const growth = next / savedScale.value;
      // Keeps the detail that was between the fingers between the fingers, and
      // lets the moving centroid carry the photograph along with it.
      tx.value =
        event.focalX - windowW / 2 - growth * (focalX.value - savedTx.value);
      ty.value =
        event.focalY - windowH / 2 - growth * (focalY.value - savedTy.value);
      scale.value = next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, spring.gentle);
        tx.value = withSpring(0, spring.gentle);
        ty.value = withSpring(0, spring.gentle);
        savedScale.value = MIN_SCALE;
        return;
      }
      // Springs, not timings: these are transforms, and the photo settling back
      // inside its own edges should feel like an object, not a fade.
      const maxX = Math.max(0, (fitW.value * scale.value - windowW) / 2);
      const maxY = Math.max(0, (fitH.value * scale.value - windowH) / 2);
      tx.value = withSpring(clampTo(tx.value, -maxX, maxX), spring.gentle);
      ty.value = withSpring(clampTo(ty.value, -maxY, maxY), spring.gentle);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onStart((event) => {
      if (scale.value > MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, spring.gentle);
        savedScale.value = MIN_SCALE;
        tx.value = withSpring(0, spring.gentle);
        ty.value = withSpring(0, spring.gentle);
        return;
      }

      // Zoom about the tapped detail: a point p sits at t + s·p, so holding it
      // still under the finger means t = p·(1 − s).
      const px = event.x - windowW / 2;
      const py = event.y - windowH / 2;
      const maxX = Math.max(0, (fitW.value * DOUBLE_TAP_SCALE - windowW) / 2);
      const maxY = Math.max(0, (fitH.value * DOUBLE_TAP_SCALE - windowH) / 2);

      scale.value = withSpring(DOUBLE_TAP_SCALE, spring.gentle);
      savedScale.value = DOUBLE_TAP_SCALE;
      tx.value = withSpring(
        clampTo(px * (1 - DOUBLE_TAP_SCALE), -maxX, maxX),
        spring.gentle,
      );
      ty.value = withSpring(
        clampTo(py * (1 - DOUBLE_TAP_SCALE), -maxY, maxY),
        spring.gentle,
      );
    });

  const pan = Gesture.Pan()
    // One finger only. Under `Simultaneous` a two-finger pinch also feeds the
    // pan handler, and the two then fight over the same translation.
    .maxPointers(1)
    .minDistance(6)
    .onStart(() => {
      axis.value = 0;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      startPageX.value = pageX.value;
    })
    .onUpdate((event) => {
      // Zoomed in: the finger moves the photograph inside its own frame.
      if (scale.value > MIN_SCALE) {
        const maxX = Math.max(0, (fitW.value * scale.value - windowW) / 2);
        const maxY = Math.max(0, (fitH.value * scale.value - windowH) / 2);
        tx.value = clampTo(savedTx.value + event.translationX, -maxX, maxX);
        ty.value = clampTo(savedTy.value + event.translationY, -maxY, maxY);
        return;
      }

      // At rest: the first decisive movement decides what the drag is for, and
      // it keeps that job until the finger lifts. Anything else means a swipe
      // that curves ends up doing half of each.
      if (axis.value === 0) {
        const dx = Math.abs(event.translationX);
        const dy = Math.abs(event.translationY);
        if (dx > dy + AXIS_SLOP && count > 1) {
          axis.value = 1;
        } else if (event.translationY > 0 && dy > dx + AXIS_SLOP) {
          axis.value = 2;
        } else {
          return;
        }
      }

      if (axis.value === 1) {
        const raw = startPageX.value + event.translationX;
        const min = -(count - 1) * pageWidth;
        // Past either end the wall resists rather than stopping dead, which is
        // what tells a thumb there is nothing further this way.
        pageX.value =
          raw > 0
            ? raw * EDGE_RESISTANCE
            : raw < min
              ? min + (raw - min) * EDGE_RESISTANCE
              : raw;
        return;
      }

      dragY.value = Math.max(0, event.translationY);
      dragX.value = event.translationX * 0.35;
    })
    .onEnd((event) => {
      if (scale.value > MIN_SCALE) return;

      if (axis.value === 1) {
        let next = pageIndex.value;
        const far = pageWidth * PAGE_THRESHOLD;
        if (
          (event.translationX <= -far || event.velocityX <= -PAGE_VELOCITY) &&
          next < count - 1
        ) {
          next += 1;
        } else if (
          (event.translationX >= far || event.velocityX >= PAGE_VELOCITY) &&
          next > 0
        ) {
          next -= 1;
        }

        if (next !== pageIndex.value) {
          pageIndex.value = next;
          runOnJS(commitPage)(next);
        }
        pageX.value = withSpring(-next * pageWidth, {
          ...spring.snappy,
          velocity: event.velocityX,
        });
        axis.value = 0;
        return;
      }

      if (axis.value === 2) {
        const goes =
          dragY.value > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

        if (goes) {
          // Leaving is quicker than arriving. `exitTiming()` carries
          // ReduceMotion.System, so on a device that asks for less motion the
          // photograph simply goes and the callback still fires.
          dragX.value = withTiming(dragX.value, exitTiming());
          dragY.value = withTiming(windowH, exitTiming(), (finished) => {
            if (finished) runOnJS(handleClose)();
          });
          return;
        }

        dragX.value = withSpring(0, spring.gentle);
        dragY.value = withSpring(0, spring.gentle);
      }

      axis.value = 0;
    });

  const gesture = Gesture.Exclusive(
    doubleTap,
    Gesture.Simultaneous(pinch, pan),
  );

  // ── Animated styles ────────────────────────────────────────────────

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX.value }],
  }));

  // Built once, here, and handed to whichever page is on screen: zoom belongs
  // to the photograph being looked at, not to the two waiting either side of
  // it, and a hook cannot be called inside the map below.
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const stageStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      dragY.value,
      [0, windowH * DISMISS_RANGE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: dragX.value },
        { translateY: dragY.value },
        { scale: interpolate(progress, [0, 1], [1, 0.86]) },
      ],
    };
  });

  // Chrome fades as the photograph is dragged away. Driven by the drag itself
  // and clamped, never sprung — a spring on opacity clamps at 1.0 and stalls.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragY.value,
      [0, windowH * DISMISS_RANGE * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const active = pages[page];

  return (
    <View style={styles.viewer}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <Animated.View style={[styles.track, trackStyle]}>
            {pages.map((photo, i) =>
              // Only the photograph on screen and its two neighbours are
              // mounted: the neighbours so a swipe lands on an image rather
              // than on a placeholder, and nothing further so that a parent's
              // whole term does not sit decoded in memory.
              Math.abs(i - page) <= 1 ? (
                <ViewerPage
                  key={photo.id ?? `${photo.uri}-${i}`}
                  photo={photo}
                  active={i === page}
                  left={i * pageWidth}
                  width={windowW}
                  height={windowH}
                  onIntrinsicSize={reportIntrinsicSize}
                  zoom={i === page ? zoomStyle : undefined}
                />
              ) : null,
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        style={[styles.chrome, { paddingTop: insets.top + spacing.sm }, chromeStyle]}
        pointerEvents="box-none"
      >
        {count > 1 ? (
          <Text
            variant="caption"
            onInk
            muted
            style={styles.counter}
            accessibilityRole="adjustable"
            accessibilityLabel="Photo"
            accessibilityValue={{
              min: 1,
              max: count,
              now: page + 1,
              text: `${page + 1} of ${count}`,
            }}
            accessibilityActions={A11Y_PAGE_ACTIONS}
            onAccessibilityAction={handleAccessibilityAction}
          >
            {page + 1} of {count}
          </Text>
        ) : (
          <View />
        )}

        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <Ionicons name="close" size={22} color={colors.text.onInk} />
        </Pressable>
      </Animated.View>

      {active?.caption ? (
        <Animated.View
          style={[
            styles.foot,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
            chromeStyle,
          ]}
          pointerEvents="none"
        >
          <Text variant="bodySmall" onInk numberOfLines={3}>
            {active.caption}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// A page
// ---------------------------------------------------------------------------

interface ViewerPageProps {
  photo: ViewerPhoto;
  /** Whether this is the photograph on screen. */
  active: boolean;
  /** Offset within the track. */
  left: number;
  width: number;
  height: number;
  /** Reports the photo's real proportions once it has decoded. */
  onIntrinsicSize: (width: number, height: number) => void;
  /** The live zoom transform — passed only to the photograph on screen. */
  zoom?: StyleProp<ViewStyle>;
}

function ViewerPage({
  photo,
  active,
  left,
  width,
  height,
  onIntrinsicSize,
  zoom,
}: ViewerPageProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  /** Bumped by a retry — remounts the image, so a failed fetch runs again. */
  const [attempt, setAttempt] = useState(0);
  const intrinsic = useRef<{ w: number; h: number } | null>(null);

  // A page that has already decoded does not fire `onLoad` again when it comes
  // back on screen, so it re-states its proportions when it becomes active.
  useEffect(() => {
    if (active && intrinsic.current) {
      onIntrinsicSize(intrinsic.current.w, intrinsic.current.h);
    }
  }, [active, onIntrinsicSize]);

  const handleLoad = useCallback(
    (event: { source: { width: number; height: number } }) => {
      intrinsic.current = {
        w: event.source.width,
        h: event.source.height,
      };
      setStatus('ready');
      if (active) onIntrinsicSize(event.source.width, event.source.height);
    },
    [active, onIntrinsicSize],
  );

  const handleError = useCallback(() => setStatus('error'), []);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return (
    <Animated.View
      style={[styles.page, { left, width, height }, zoom]}
      pointerEvents="box-none"
    >
      {status !== 'error' && (
        <HiveImage
          key={attempt}
          uri={photo.uri}
          blurhash={photo.blurhash}
          contentFit="contain"
          recyclingKey={`${photo.id ?? photo.uri}:${attempt}`}
          // The photograph on screen is the only thing this screen exists for.
          priority={active ? 'high' : 'low'}
          cachePolicy="memory-disk"
          onLoad={handleLoad}
          onError={handleError}
          accessibilityLabel={photo.caption ?? 'Photo'}
          style={{ width, height }}
        />
      )}

      {status === 'loading' && !photo.blurhash && (
        <LoadingPlate width={width} height={height} />
      )}

      {status === 'error' && <PageError onRetry={handleRetry} />}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Loading and failure
// ---------------------------------------------------------------------------

/**
 * What stands in for a photograph that has no blurhash.
 *
 * Not a spinner: a spinner says the app is busy, which a parent already knows.
 * An empty print-shaped plate says a photograph is arriving and roughly what
 * shape it will be. It waits out {@link SKELETON_DELAY} first, so a photo
 * already in the cache goes straight up with nothing flashing behind it, and
 * the light on it drifts rather than blinking — a pulse reads as an error
 * light, which is the same reasoning `SkeletonShimmer` is built on.
 *
 * The plate takes the album's most common print ratio, because the real one is
 * not knowable until the file has been decoded.
 */
function LoadingPlate({ width, height }: { width: number; height: number }) {
  const reduced = useReducedMotion();
  const appear = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(SKELETON_DELAY, withTiming(1, timing(duration.fast)));
  }, [appear]);

  useEffect(() => {
    if (reduced) return;
    // Reversed rather than restarted, so the light turns around instead of
    // snapping back to the start of the cycle.
    sweep.value = withRepeat(withTiming(1, timing(PLATE_SWEEP)), -1, true);
    return () => cancelAnimation(sweep);
  }, [reduced, sweep]);

  const appearStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + sweep.value * 0.4,
  }));

  const plateWidth = Math.min(width * 0.78, height * 0.62);
  const plateHeight = plateWidth / 0.8;

  return (
    <Animated.View
      style={[
        styles.plate,
        { width: plateWidth, height: plateHeight },
        appearStyle,
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduced && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.plateSweep, sweepStyle]} />
      )}
    </Animated.View>
  );
}

/** A photograph that did not arrive. Said plainly, with a way to try again. */
function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorBlock}>
      <Text variant="bodyMedium" onInk center>
        This photo didn&apos;t come through.
      </Text>
      <Text variant="bodySmall" onInk muted center style={styles.errorHint}>
        It may just be the connection.
      </Text>
      <Pressable
        onPress={onRetry}
        style={styles.retry}
        accessibilityRole="button"
        accessibilityLabel="Try loading this photo again"
      >
        <Text variant="label" color={colors.text.onInk}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  viewer: {
    ...StyleSheet.absoluteFillObject,
    // Near-neutral, not ink and not black — see the component comment.
    backgroundColor: colors.viewer.ground,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
  },
  track: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  page: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  counter: {
    paddingVertical: spacing.sm,
  },
  closeButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.white, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.ms,
    backgroundColor: colors.viewer.foot,
  },
  plate: {
    position: 'absolute',
    borderRadius: radius.print,
    backgroundColor: withAlpha(colors.text.onInk, 0.06),
    overflow: 'hidden',
  },
  plateSweep: {
    backgroundColor: withAlpha(colors.text.onInk, 0.05),
  },
  errorBlock: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorHint: {
    marginTop: spacing.xs,
  },
  retry: {
    marginTop: spacing.lg,
    minHeight: MIN_TAP_SIZE,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.onInk,
  },
});

export default PhotoViewer;
