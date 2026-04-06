import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors } from '@/theme/colors';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface HoneycombPatternProps {
  /** Hexagon fill color. @default primary amber at 10 % opacity */
  color?: string;
  /** Outer "radius" (centre-to-vertex) of each hexagon in px. @default 30 */
  size?: number;
  /** Number of rows in the tessellation. @default 6 */
  rows?: number;
  /** Number of columns in the tessellation. @default 5 */
  cols?: number;
  /** Optional container style. */
  style?: StyleProp<ViewStyle>;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Build the six vertices of a flat-topped regular hexagon centred at (cx, cy). */
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
// Component
// --------------------------------------------------------------------------

/**
 * Decorative SVG honeycomb pattern.
 *
 * Renders a tessellated grid of flat-topped hexagons that can be placed behind
 * content as a subtle background decoration.
 */
export const HoneycombPattern: React.FC<HoneycombPatternProps> = ({
  color,
  size = 30,
  rows = 6,
  cols = 5,
  style,
}) => {
  const fillColor = color ?? `${colors.primary.amber}1A`; // 10 % opacity

  // Flat-topped hex metrics
  const hexWidth = size * 2; // vertex-to-vertex horizontal
  const hexHeight = size * Math.sqrt(3); // row height
  const colSpacing = hexWidth * 0.75; // horizontal step between columns
  const rowSpacing = hexHeight; // vertical step between rows

  const svgWidth = colSpacing * (cols - 1) + hexWidth;
  const svgHeight = rowSpacing * rows + hexHeight / 2;

  const hexagons = useMemo(() => {
    const elements: React.ReactElement[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = size + col * colSpacing;
        // Odd columns are offset downward by half a row
        const cy =
          hexHeight / 2 + row * rowSpacing + (col % 2 === 1 ? hexHeight / 2 : 0);

        elements.push(
          <Polygon
            key={`${row}-${col}`}
            points={hexPoints(cx, cy, size)}
            fill={fillColor}
            stroke={fillColor}
            strokeWidth={1}
          />,
        );
      }
    }

    return elements;
  }, [rows, cols, size, fillColor, colSpacing, rowSpacing, hexHeight]);

  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={style}
    >
      {hexagons}
    </Svg>
  );
};

export default HoneycombPattern;
