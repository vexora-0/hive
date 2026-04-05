import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ConfettiOverlayProps {
  /** When `true` a new burst of confetti fires. Toggle off then on to repeat. */
  trigger: boolean;
  /** Total duration of the fall animation in ms. @default 2500 */
  duration?: number;
  /** Palette for confetti pieces. @default themed selection */
  colors?: string[];
  /** Number of confetti pieces to spawn. @default 40 */
  count?: number;
}

// --------------------------------------------------------------------------
// Defaults
// --------------------------------------------------------------------------

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DEFAULT_COLORS = [
  colors.primary.amber,
  colors.primary.blue,
  colors.primary.mint,
  colors.primary.lavender,
  colors.error.main,
  colors.success.main,
];

// --------------------------------------------------------------------------
// Piece definition
// --------------------------------------------------------------------------

interface PieceDef {
  id: number;
  x: number;
  width: number;
  height: number;
  color: string;
  delay: number;
  /** Horizontal drift in px (positive = right). */
  drift: number;
  isCircle: boolean;
}

function buildPieces(count: number, palette: string[]): PieceDef[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_W,
    width: 6 + Math.random() * 6,
    height: 6 + Math.random() * 10,
    color: palette[i % palette.length],
    delay: Math.random() * 400,
    drift: (Math.random() - 0.5) * 80,
    isCircle: Math.random() > 0.5,
  }));
}

// --------------------------------------------------------------------------
// Single confetti piece (animated)
// --------------------------------------------------------------------------

interface PieceProps {
  piece: PieceDef;
  trigger: boolean;
  duration: number;
}

const ConfettiPiece: React.FC<PieceProps> = ({ piece, trigger, duration }) => {
  const translateY = useSharedValue(-40);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!trigger) {
      // Reset when trigger is turned off
      cancelAnimation(translateY);
      cancelAnimation(translateX);
      cancelAnimation(opacity);
      cancelAnimation(rotate);
      translateY.value = -40;
      translateX.value = 0;
      opacity.value = 0;
      rotate.value = 0;
      return;
    }

    const fallDuration = duration + piece.delay;

    opacity.value = withDelay(
      piece.delay,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(
          fallDuration - 500,
          withTiming(0, { duration: 400 }),
        ),
      ),
    );

    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_H + 40, {
        duration: fallDuration,
        easing: Easing.in(Easing.quad),
      }),
    );

    translateX.value = withDelay(
      piece.delay,
      withTiming(piece.drift, {
        duration: fallDuration,
        easing: Easing.inOut(Easing.sin),
      }),
    );

    rotate.value = withDelay(
      piece.delay,
      withTiming(360 * (Math.random() > 0.5 ? 1 : -1) * 3, {
        duration: fallDuration,
        easing: Easing.linear,
      }),
    );
  }, [trigger, duration, piece, translateY, translateX, opacity, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: piece.x,
          top: 0,
          width: piece.width,
          height: piece.isCircle ? piece.width : piece.height,
          borderRadius: piece.isCircle ? piece.width / 2 : 2,
          backgroundColor: piece.color,
        },
        animatedStyle,
      ]}
    />
  );
};

// --------------------------------------------------------------------------
// Overlay
// --------------------------------------------------------------------------

/**
 * Full-screen confetti overlay.
 *
 * Set `trigger` to `true` to fire a burst. Toggle it off and back on to
 * replay. The overlay is `pointerEvents="none"` so it never blocks touches.
 */
export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({
  trigger,
  duration = 2500,
  colors: palette = DEFAULT_COLORS,
  count = 40,
}) => {
  const pieces = useMemo(() => buildPieces(count, palette), [count, palette]);

  if (!trigger) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          piece={piece}
          trigger={trigger}
          duration={duration}
        />
      ))}
    </View>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});

export default ConfettiOverlay;
