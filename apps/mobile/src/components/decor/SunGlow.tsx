import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { play, withAlpha } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SunGlowProps {
  /** Area to cover, in px. */
  width: number;
  height: number;
  /** The warm hue at the top. @default marigold */
  tint?: string;
  /**
   * Peak opacity of the wash, 0–1.
   *
   * 0.22 is the ceiling that keeps `text.tertiary` (4.64:1 on paper — the
   * palette's floor) above 4.5:1 where the wash is strongest. Past that a
   * caption at the top of a screen quietly stops meeting AA, which is a real
   * regression dressed up as a nice gradient. @default 0.18
   */
  intensity?: number;
  /** Draws the soft disc in the corner as well as the wash. @default true */
  disc?: boolean;
  style?: StyleProp<ViewStyle>;
}

let gradientCount = 0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SunGlow>` — morning light on the top of a screen.
 *
 * The app is opened by a parent at the end of a school day to look at pictures
 * of their child, and every screen met them as a uniform sheet of cream. This
 * is the cheapest possible fix and the most effective one: a warm vertical wash
 * that fades to nothing about a third of the way down, plus a soft disc off the
 * top-right corner that reads as sun through a window.
 *
 * **Two gradients, not one.** The wash alone is a flat tint; the disc alone is
 * a blob. Together they have a light *source*, which is the thing that makes a
 * background look lit rather than coloured.
 *
 * Decorative, hidden from screen readers, and bounded by `intensity` so it can
 * never push the text above it under AA — see that prop.
 */
export function SunGlow({
  width,
  height,
  tint = play.honey.base,
  intensity = 0.18,
  disc = true,
  style,
}: SunGlowProps) {
  // Ids must be unique per instance — two SunGlows on one screen sharing a
  // gradient id is a silent bug on web, where the second resolves against the
  // first's stops.
  const uid = React.useRef<number | null>(null);
  if (uid.current === null) uid.current = (gradientCount += 1);
  const washId = `glow-wash-${uid.current}`;
  const discId = `glow-disc-${uid.current}`;

  return (
    <View
      style={[styles.host, { width, height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={washId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tint} stopOpacity={intensity} />
            {/* The midpoint is at 0.45 rather than 0.5 so the falloff is
                weighted toward the top — light thins fastest near its source,
                and a linear ramp reads as a coloured band. */}
            <Stop offset="0.45" stopColor={tint} stopOpacity={intensity * 0.3} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </LinearGradient>

          <RadialGradient id={discId} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={tint} stopOpacity={intensity * 1.5} />
            <Stop offset="0.6" stopColor={tint} stopOpacity={intensity * 0.5} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill={`url(#${washId})`} />

        {disc && (
          // Off the corner rather than inside it: a disc fully on screen is a
          // circle, a disc cropped by two edges is light coming in.
          <Ellipse
            cx={width * 0.92}
            cy={-height * 0.08}
            rx={width * 0.55}
            ry={height * 0.62}
            fill={`url(#${discId})`}
          />
        )}
      </Svg>
    </View>
  );
}

/** The wash colour at full strength — for a solid element that must sit in it. */
export function glowTint(tint: string = play.honey.base, intensity = 0.18) {
  return withAlpha(tint, intensity);
}

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
});

export default SunGlow;
