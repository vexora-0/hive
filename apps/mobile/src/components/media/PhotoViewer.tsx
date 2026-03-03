import React, { useCallback } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing } from '@/theme';
import { HiveImage } from './HiveImage';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoViewerProps {
  /** Image URI. */
  uri: string;
  /** Blurhash placeholder. */
  blurhash?: string;
  /** Called when the user requests to close the viewer. */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PhotoViewer>` — full-screen photo viewer with gesture controls.
 *
 * Supports:
 * - **Pinch to zoom** via react-native-gesture-handler's `Gesture.Pinch`.
 * - **Double-tap** to toggle between 1x and 2.5x zoom.
 * - A close button in the top-right corner.
 *
 * ```tsx
 * <PhotoViewer
 *   uri="https://example.com/photo.jpg"
 *   onClose={() => navigation.goBack()}
 * />
 * ```
 */
export function PhotoViewer({ uri, blurhash, onClose }: PhotoViewerProps) {
  // ── Shared values ──────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // ── Close handler (needs runOnJS bridge) ───────────────────────────
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // ── Pinch gesture ──────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(
        Math.max(savedScale.value * event.scale, MIN_SCALE),
        MAX_SCALE,
      );
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
      }
    });

  // ── Double-tap gesture ─────────────────────────────────────────────
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart((event) => {
      if (scale.value > MIN_SCALE) {
        // Reset to 1x
        scale.value = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      } else {
        // Zoom to 2.5x centred on tap location
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        translateX.value = withTiming(
          (SCREEN_WIDTH / 2 - event.x) * (DOUBLE_TAP_SCALE - 1),
        );
        translateY.value = withTiming(
          (SCREEN_HEIGHT / 2 - event.y) * (DOUBLE_TAP_SCALE - 1),
        );
      }
    });

  // ── Pan gesture (only when zoomed in) ──────────────────────────────
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > MIN_SCALE) {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  // Compose gestures: pinch + pan run simultaneously, double-tap is exclusive
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
  );
  const finalGesture = Gesture.Exclusive(doubleTapGesture, composedGesture);

  // ── Animated style ─────────────────────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.backdrop}>
      {/* Close button */}
      <Pressable
        onPress={handleClose}
        style={styles.closeButton}
        hitSlop={16}
      >
        <Text variant="h3" color={colors.white}>
          {'\u00D7'}
        </Text>
      </Pressable>

      {/* Zoomable image */}
      <GestureDetector gesture={finalGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <HiveImage
            uri={uri}
            blurhash={blurhash}
            contentFit="contain"
            style={styles.image}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    right: spacing.md,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default PhotoViewer;
