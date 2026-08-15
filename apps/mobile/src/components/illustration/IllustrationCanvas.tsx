import React from 'react';
import { View } from 'react-native';
import Svg, { G } from 'react-native-svg';

import { colors } from '@/theme';

import {
  DEFAULT_ILLUSTRATION_COLOR,
  DEFAULT_ILLUSTRATION_SIZE,
  ILLUSTRATION_STROKE_WIDTH,
  ILLUSTRATION_VIEW_BOX,
  WASH_OPACITY,
  type IllustrationProps,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IllustrationCanvasProps extends IllustrationProps {
  /**
   * The one marigold shape painted behind the line — the sky, the missing
   * photograph, the tinted glass. Rendered only when `wash` is true, and
   * deliberately singular: two washed shapes and the drawing has a second
   * colour doing composition, which is the thing the palette forbids.
   */
  washShape?: React.ReactNode;
  /** The line work, drawn on the 120 grid. Stroke is inherited, not repeated. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The frame every spot illustration is drawn in.
 *
 * It exists so the specification is applied rather than remembered. Grid,
 * stroke weight, cap and join, the single ink, the wash opacity and the
 * screen-reader treatment are all set once, here; a drawing file contains
 * nothing but its own shapes. That is why none of the seven can quietly drift
 * to a different stroke weight, and why an eighth is hard to get wrong.
 *
 * Stroke properties are set on a wrapping `<G>` and inherited by every child,
 * so the shapes carry geometry and nothing else.
 *
 * **Decorative, always.** The two accessibility props are the iOS and Android
 * halves of the same instruction: skip this. An empty state must read
 * completely with the picture deleted — the heading and the sentence beneath
 * it carry the meaning, and a screen reader announcing "image" here would be
 * noise between the two things that matter.
 */
export function IllustrationCanvas({
  size = DEFAULT_ILLUSTRATION_SIZE,
  color = DEFAULT_ILLUSTRATION_COLOR,
  wash = false,
  style,
  washShape,
  children,
}: IllustrationCanvasProps) {
  return (
    <View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox={ILLUSTRATION_VIEW_BOX}>
        {wash && washShape ? (
          <G fill={colors.primary.amber} stroke="none" opacity={WASH_OPACITY}>
            {washShape}
          </G>
        ) : null}

        <G
          fill="none"
          stroke={color}
          strokeWidth={ILLUSTRATION_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </G>
      </Svg>
    </View>
  );
}

export default IllustrationCanvas;
