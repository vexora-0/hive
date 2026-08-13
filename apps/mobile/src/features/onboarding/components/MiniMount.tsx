import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  withAlpha,
} from '@/theme';
import { Text } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MiniMountProps {
  /** Unique within the screen — SVG gradient ids are global to the document. */
  id: string;
  /** Width of the whole mount, mat included. */
  width: number;
  /** Aspect ratio of the print inside it. */
  ratio?: number;
  /** The two ends of the window's gradient. */
  from: string;
  to: string;
  /** Printed in the bottom margin. Omit for a blank mat. */
  caption?: string;
  /** Draws the folded marigold corner. */
  isNew?: boolean;
  /** Degrees of tilt. A pinned print is never perfectly straight. */
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<MiniMount>` — a photo mount at vignette scale, for the intro carousel.
 *
 * The onboarding has no photographs to show: the app ships four icons and a
 * stub Lottie, and putting invented children in front of a parent to sell them
 * a privacy product would be the wrong trade. So the window holds a soft
 * gradient and one out-of-focus highlight — the shape of a photograph without
 * pretending to be one — inside a real mat, with a real caption and the real
 * marigold corner fold.
 *
 * Everything else about it matches `<PhotoMount>`: same paper, same corner
 * radii, same uneven bottom margin. What a parent sees here is what they get.
 */
export function MiniMount({
  id,
  width,
  ratio = 1,
  from,
  to,
  caption,
  isNew = false,
  tilt = 0,
  style,
}: MiniMountProps) {
  const windowWidth = width - MAT * 2;
  const windowHeight = windowWidth / ratio;

  return (
    <View
      style={[
        styles.mount,
        { width, transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <View style={[styles.window, { height: windowHeight }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`grad-${id}`} x1="0" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#grad-${id})`} />
          {/* The blown highlight a camera leaves in a bright room. */}
          <Circle
            cx="72%"
            cy="26%"
            r={windowWidth * 0.17}
            fill={withAlpha(colors.white, 0.34)}
          />
        </Svg>
      </View>

      <View style={styles.margin}>
        {caption ? (
          <Text variant="tiny" color={colors.text.tertiary} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>

      {isNew && (
        <>
          <View style={styles.foldShadow} />
          <View style={styles.fold} />
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MAT = spacing.sm;
const MARGIN = spacing.md;
const FOLD = 14;

const styles = StyleSheet.create({
  mount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: MAT,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  window: {
    width: '100%',
    borderRadius: radius.print,
    overflow: 'hidden',
    backgroundColor: colors.background.surfaceSecondary,
  },
  margin: {
    minHeight: MARGIN,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.sm,
    justifyContent: 'center',
  },
  fold: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: FOLD,
    borderLeftWidth: FOLD,
    borderTopColor: colors.primary.amber,
    borderLeftColor: colors.transparent,
    borderTopRightRadius: radius.mount,
  },
  foldShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: FOLD + 2,
    borderLeftWidth: FOLD + 2,
    borderTopColor: colors.primary.amberLight,
    borderLeftColor: colors.transparent,
    borderTopRightRadius: radius.mount,
  },
});

export default MiniMount;
