import React, { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  spacing,
  layout,
  spring,
  pressScale,
  MIN_TAP_SIZE,
} from '@/theme';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface HoneycombFABProps {
  /** Called when the user taps the button. */
  onPress: () => void;
  /**
   * Content rendered at the centre of the hexagon.
   *
   * **Draw it in ink.** The hexagon is marigold, and marigold is a surface —
   * `#F0A03A` measures 2.03:1 on paper, so nothing that has to be read may be
   * set in it. `colors.ink[900]` on marigold is 8.08:1; that pairing is the
   * letterpress look, not a compromise.
   */
  icon: React.ReactNode;
  /** Fill color for the hexagon shape. @default marigold */
  color?: string;
  /** Outer "radius" of the hexagon (centre to vertex). @default 32 */
  size?: number;
  /** Announced by screen readers. Required — a hexagon has no label of its own. */
  accessibilityLabel: string;
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

/**
 * How much invisible touch area to add on each side so the control clears
 * `MIN_TAP_SIZE` whatever `size` it is given.
 *
 * The shape is wider than it is tall — a flat-topped hexagon of radius r
 * measures 2r across and r√3 down — so the two axes have to be padded
 * separately, and the height is the one that runs short first (it drops under
 * 44dp at r ≈ 25.4).
 */
function hitSlopFor(extent: number): number {
  return Math.max(0, (MIN_TAP_SIZE - extent) / 2);
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * The app's floating action button, and the only one.
 *
 * A hexagon rather than a circle because the honeycomb is Hive's single
 * decorative device, and spending it on the one control that floats above the
 * page is the cheapest place to be recognisable. Anything that needs a
 * persistent primary action on a screen uses this — a second, rounder FAB
 * invented inline is how an app ends up with two idioms and no signature.
 *
 * Three things it guarantees so that call sites do not have to:
 *
 *  - **Marigold is the surface, ink is the mark.** See `icon`.
 *  - **The target clears 44dp** at any `size`, via `hitSlop` on the short axis.
 *  - **It clears the floating tab bar on every device**, safe area included —
 *    see the arithmetic below. No screen passes its own offset.
 *  - **Press physics come from the theme.** `spring.press` is tuned for exactly
 *    this distance — a scale of 1 → 0.9 — and carries `ReduceMotion.System`, so
 *    the button does the right thing on a device where the setting is on.
 *
 * ```tsx
 * <HoneycombFAB
 *   onPress={goToUpload}
 *   accessibilityLabel="Upload photos"
 *   icon={<Ionicons name="camera" size={24} color={colors.ink[900]} />}
 * />
 * ```
 */
export const HoneycombFAB: React.FC<HoneycombFABProps> = ({
  onPress,
  icon,
  color = colors.primary.amber,
  size = 32,
  accessibilityLabel,
  style,
}) => {
  const scale = useSharedValue(1);
  const insets = useSafeAreaInsets();

  /**
   * How far the button floats above the bottom edge.
   *
   * **This is a mirror of `TabBar.tsx`, not a guess — please do not "simplify"
   * it back to `layout.tabBarClearance`.** That constant was here, and it is
   * the wrong one: it is a *static* figure for padding the bottom of a
   * scrolling list, and it stands in for the safe-area inset with a fixed
   * `spacing.md`. On a phone with a home indicator the inset is 34, so the real
   * bar footprint is 96 and the FAB sat at 90 — its lower edge 6px behind the
   * pill. That is the whole defect. Being 6px short is invisible on the last
   * row of a list you can scroll; it is not invisible under the one control
   * that never scrolls away.
   *
   * The bar is absolutely positioned and reserves no space, so the geometry has
   * to be reconstructed from its parts. `TabBar.tsx` renders a host at
   * `bottom: 0` with `paddingBottom: Math.max(insets.bottom, spacing.ms)`, and
   * a pill of `layout.tabBarHeight` sitting on that padding. So:
   *
   *     pill's top edge  = max(insets.bottom, spacing.ms) + tabBarHeight
   *     this button      = that, + spacing.lg
   *
   * Because both sides share the same floor expression, the visible gap is
   * exactly `spacing.lg` on every device — 24 whether the inset is 0 or 34,
   * rather than a number that shrinks as the hardware grows. `spacing.lg` is
   * what `Toast.tsx` already uses to clear the same pill; a floating element
   * over the tab bar gets a section gap, not a hairline.
   *
   * If `TabBar.tsx`'s host padding ever changes, this changes with it.
   */
  const liftAboveTabBar =
    Math.max(insets.bottom, spacing.ms) + layout.tabBarHeight + spacing.lg;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.icon, spring.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
  }, [scale]);

  const svgWidth = size * 2;
  const svgHeight = size * Math.sqrt(3);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // The hexagon is drawn by an absolutely-positioned SVG, so without an
      // explicit size the pressable collapses to the width of its icon and the
      // hexagon spills past it — off the right edge of the screen, in the one
      // place this control is ever used.
      style={[
        styles.container,
        { width: svgWidth, height: svgHeight, bottom: liftAboveTabBar },
        animatedStyle,
        // Last, so a screen without a tab bar can still override the offset.
        style,
      ]}
      // The drawn shape is the smaller of the two: a hexagon inscribed in this
      // box loses its corners, so the honest touch area is padded out rather
      // than assumed from the bounding box.
      hitSlop={{
        top: hitSlopFor(svgHeight),
        bottom: hitSlopFor(svgHeight),
        left: hitSlopFor(svgWidth),
        right: hitSlopFor(svgWidth),
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Hexagon background */}
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={StyleSheet.absoluteFill}
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
    // `bottom` is computed per-render from the safe area — see
    // `liftAboveTabBar`. It cannot live in a StyleSheet, because the value it
    // needs is not known until the device is.
    //
    // `right` matches `layout.tabBarInset`, which is deliberate: the button's
    // right edge lands on the same line as the pill's, so the two floating
    // shapes share one margin instead of nearly sharing one.
    right: layout.tabBarInset,
    alignItems: 'center',
    justifyContent: 'center',
    // Deliberately no shadow: a shadow follows the view's rectangular border
    // box, not the hexagon drawn inside it, so it renders as a grey square
    // behind the shape. Depth comes from the ink tab bar it sits above.
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HoneycombFAB;
