import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors } from '@/theme';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Points of a flat-top hexagon with circumradius `r` centred on (`cx`, `cy`).
 * Flat-top rather than pointy-top because that is how cells actually tile in a
 * comb, and the flat edge gives the mark a base to stand on.
 */
function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HiveMarkProps {
  /** Overall width and height in px. @default 48 */
  size?: number;
  /** Fill colour of the outer cell. @default marigold */
  color?: string;
  /** Colour of the inner cell outline. @default ink */
  detail?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HiveMark>` — the app's mark: a single comb cell with a second cell drawn
 * inside it.
 *
 * One cell, not a swarm. The product is one child's collection inside one
 * school, and a mark that says "cell within a cell" carries that better than a
 * bee or a full honeycomb, both of which turn to mush below 32px.
 *
 * ```tsx
 * <HiveMark size={56} />
 * ```
 */
export function HiveMark({
  size = 48,
  color = colors.primary.amber,
  detail = colors.ink[900],
  style,
}: HiveMarkProps) {
  const c = 50;
  const outer = 46;
  const inner = 22;

  return (
    <View style={style} accessibilityRole="image" accessibilityLabel="Hive">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={hexPoints(c, c, outer)} fill={color} />
        <Polygon
          points={hexPoints(c, c, inner)}
          fill="none"
          stroke={detail}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export default HiveMark;
