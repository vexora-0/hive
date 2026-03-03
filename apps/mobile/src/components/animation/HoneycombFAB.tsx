import React, { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface HoneycombFABProps {
  /** Called when the user taps the button. */
  onPress: () => void;
  /** Content rendered at the centre of the hexagon. */
  icon: React.ReactNode;
  /** Fill color for the hexagon shape. @default primary amber */
  color?: string;
  /** Outer "radius" of the hexagon (centre to vertex). @default 32 */
  size?: number;
  /** Optional extra styles for the outer wrapper (position overrides, etc.). */
  style?: StyleProp<ViewStyle>;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Flat-topped hexagon vertices centred at (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    pts.push(
      `${(cx + r * Math.cos(angleRad)).toFixed(2)},${(cy + r * Math.sin(angleRad)).toFixed(2)}`,
    );
  }
  return pts.join(' ');
}

// --------------------------------------------------------------------------
// Spring config
// --------------------------------------------------------------------------

const SPRING_CONFIG = {
  damping: 12,
  stiffness: 180,
  mass: 0.8,
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * Hexagon-shaped floating action button.
 *
 * Positioned `absolute` at the bottom-right of its parent by default.
 * Scales down with a spring on press, then bounces back on release.
 */
export const HoneycombFAB: React.FC<HoneycombFABProps> = ({
  onPress,
  icon,
  color = colors.primary.amber,
  size = 32,
  style,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.85, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const boxSize = size * 2;
  const svgWidth = boxSize;
  const svgHeight = size * Math.sqrt(3);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle, style]}
      accessibilityRole="button"
    >
      {/* Hexagon background */}
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={styles.svg}
      >
        <Polygon
          points={hexPoints(svgWidth / 2, svgHeight / 2, size)}
          fill={color}
        />
      </Svg>

      {/* Icon overlay */}
      <Animated.View style={styles.iconContainer}>{icon}</Animated.View>
    </AnimatedPressable>
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HoneycombFAB;
