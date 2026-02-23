import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle as RNTextStyle,
} from 'react-native';

import { colors, getTextStyle, type TypographyVariant } from '@/theme';

// ---------------------------------------------------------------------------
// The component accepts every built-in variant from the theme's typography
// map.  Headings automatically use Baloo2; body / caption / tiny use Nunito.
// ---------------------------------------------------------------------------

export type TextVariant = TypographyVariant;

export interface TextProps extends RNTextProps {
  /** Typography preset.  Defaults to `'body'`. */
  variant?: TextVariant;
  /** Shorthand text color.  Defaults to `colors.text.primary`. */
  color?: string;
  /** If `true`, center-aligns the text. */
  center?: boolean;
  children?: React.ReactNode;
}

/**
 * `<Text>` — themed text component.
 *
 * Picks the correct `fontFamily`, `fontSize` and `lineHeight` for the chosen
 * variant and applies the project color palette automatically.
 *
 * ```tsx
 * <Text variant="h1">Welcome to Hive!</Text>
 * <Text variant="bodySmall" color={colors.text.secondary}>Subtitle</Text>
 * ```
 */
export function Text({
  variant = 'body',
  color: colorProp,
  center,
  style,
  ...rest
}: TextProps) {
  const typographyStyle = getTextStyle(variant);
  const resolvedColor = colorProp ?? colors.text.primary;

  const merged: StyleProp<RNTextStyle> = [
    {
      fontFamily: typographyStyle.fontFamily,
      fontSize: typographyStyle.fontSize,
      lineHeight: typographyStyle.lineHeight,
      color: resolvedColor,
    },
    center && { textAlign: 'center' as const },
    style,
  ];

  return <RNText style={merged} {...rest} />;
}

export default Text;
