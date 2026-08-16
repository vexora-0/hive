import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';

import { play, hexPoints, combPitch } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CombFieldProps {
  /** Area to cover, in px. */
  width: number;
  height: number;
  /**
   * Circumradius of one cell, in px. Bigger reads as architecture, smaller as
   * texture. @default 34
   */
  cell?: number;
  /**
   * How visible the comb is, 0–1.
   *
   * **The default is 0.055 and it is deliberately almost nothing.** A texture
   * you consciously notice on a screen holding photographs of children is a
   * texture competing with them. This one exists to stop a full-bleed cream
   * page reading as blank, and the test is that you should only see it if you
   * go looking. @default 0.055
   */
  opacity?: number;
  /** Line colour. @default marigold's deep tone */
  color?: string;
  /** Fills every third cell as well as outlining it, for a denser weave. */
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<CombField>` — the honeycomb the whole app sits on.
 *
 * Hive's page was one flat cream rectangle, and flat cream at full-bleed is
 * indistinguishable from an unstyled `<View>`. This is the fix: a real comb,
 * tiled from the same `hexPoints` the mark and the tab puck use, at an opacity
 * low enough that it is atmosphere rather than pattern.
 *
 * **The tiling is computed, not eyeballed.** Flat-top cells step 1.5r across
 * and √3·r down with alternate columns dropped half a row; getting either
 * figure wrong leaves seams, and a seam in a background texture is the single
 * loudest "this was generated" signal a screen can carry. Both come from
 * `combPitch()`, which is shared with everything else that tiles a comb.
 *
 * Purely decorative and hidden from screen readers.
 *
 * ```tsx
 * <CombField width={width} height={220} />
 * ```
 */
export function CombField({
  width,
  height,
  cell = 34,
  opacity = 0.055,
  color = play.honey.deep,
  dense = false,
  style,
}: CombFieldProps) {
  const cells = useMemo(() => {
    const { dx, dy } = combPitch(cell);
    const out: { key: string; points: string; filled: boolean }[] = [];

    // One column and one row of overscan on every side, so a cell clipped by
    // the edge is a cell that continues past it rather than a cell that stops.
    const cols = Math.ceil(width / dx) + 2;
    const rows = Math.ceil(height / dy) + 2;

    for (let col = -1; col < cols; col++) {
      for (let row = -1; row < rows; row++) {
        const cx = col * dx;
        const cy = row * dy + (col % 2 === 0 ? 0 : dy / 2);
        out.push({
          key: `${col}:${row}`,
          points: hexPoints(cx, cy, cell),
          // Every third cell on a 2D index, so the filled ones scatter instead
          // of forming stripes — `(col + row) % 3` walks diagonally, which is
          // what makes the weave read as woven.
          filled: dense && (col + row) % 3 === 0,
        });
      }
    }
    return out;
  }, [width, height, cell, dense]);

  return (
    <View
      style={[styles.host, { width, height, opacity }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <G stroke={color} strokeWidth={1.6} strokeLinejoin="round">
          {cells.map((c) => (
            <Polygon
              key={c.key}
              points={c.points}
              fill={c.filled ? color : 'none'}
              fillOpacity={c.filled ? 0.5 : 0}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
});

export default CombField;
