import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle as RNTextStyle,
} from 'react-native';

import { colors, getTextStyle, type TypographyVariant } from '@/theme';

// ---------------------------------------------------------------------------
// Every variant from the theme's typography map. Display sizes (`display`,
// `h1`–`h3`) are set in Fraunces; everything else is Plus Jakarta Sans.
// ---------------------------------------------------------------------------

export type TextVariant = TypographyVariant;

export interface TextProps extends RNTextProps {
  /** Typography preset. Defaults to `'body'`. */
  variant?: TextVariant;
  /** Shorthand text color. Defaults to `colors.text.primary`. */
  color?: string;
  /** If `true`, center-aligns the text. */
  center?: boolean;
  /** Renders the text in the colour used for copy on a dark surface. */
  onInk?: boolean;
  /** Dims to the secondary text colour — shorthand for the common case. */
  muted?: boolean;
  children?: React.ReactNode;
}

/**
 * `<Text>` — themed text.
 *
 * Picks the family, size, line height, tracking and case for the chosen
 * variant, so a screen never sets a font by hand.
 *
 * ```tsx
 * <Text variant="h1">Aarav's week</Text>
 * <Text variant="eyebrow" muted>This morning</Text>
 * <Text variant="price">₹499</Text>
 * ```
 */
export function Text({
  variant = 'body',
  color: colorProp,
  center,
  onInk,
  muted,
  style,
  ...rest
}: TextProps) {
  const typographyStyle = getTextStyle(variant);

  const resolvedColor =
    colorProp ??
    (onInk
      ? muted
        ? colors.text.onInkMuted
        : colors.text.onInk
      : muted
        ? colors.text.secondary
        : colors.text.primary);

  const merged: StyleProp<RNTextStyle> = [
    {
      fontFamily: typographyStyle.fontFamily,
      fontSize: typographyStyle.fontSize,
      lineHeight: typographyStyle.lineHeight,
      letterSpacing: typographyStyle.letterSpacing,
      textTransform: typographyStyle.textTransform,
      fontVariant: typographyStyle.fontVariant,
      color: resolvedColor,
    },
    center && { textAlign: 'center' as const },
    style,
  ];

  return <RNText style={merged} {...rest} />;
}

export default Text;
