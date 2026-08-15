import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle as RNTextStyle,
} from 'react-native';

import { colors, getTextStyle, type TypographyVariant } from '@/theme';

// ---------------------------------------------------------------------------
// Types
//
// Every variant in the theme's typography map is reachable from here, which is
// the point: a screen picks a *role* ("this is a section title") and the theme
// decides the family, size, leading, tracking and case. No screen sets a font.
//
// The two voices split by job rather than by size. Fraunces carries `display`,
// `displayLight`, `h1`–`h3` and `editorial`; Plus Jakarta Sans carries
// everything from `h4` down, because below 20pt Fraunces stops being legible at
// a glance and legibility is the only thing a sub-heading has to do.
// ---------------------------------------------------------------------------

export type TextVariant = TypographyVariant;

export interface TextProps extends RNTextProps {
  /**
   * Typography preset. Defaults to `'body'`.
   *
   * Two of these carry usage rules the type system cannot express:
   *
   *  - **`displayLight`** is Fraunces 300 at 40pt. The weight is only allowed
   *    at ≥32pt — below that it thins out on a classroom-lit phone and loses
   *    the serifs that make it Fraunces — so the variant pins its own size and
   *    you should not override `fontSize` downward through `style`.
   *  - **`editorial`** is Fraunces 400 italic at 18pt: the one written-sounding
   *    line a screen is allowed. A child's name, a memory date, the sentence in
   *    an empty state. **One per screen.** A second italic line stops reading as
   *    a voice and starts reading as a style.
   */
  variant?: TextVariant;
  /**
   * Explicit text colour. Defaults to `colors.text.primary`.
   *
   * Anything passed here must clear 4.5:1 on the surface behind it. The palette
   * is built so that every `text.*` value and every `.main` does; marigold
   * `#F0A03A` (2.03:1) does not, and is caught in development below.
   */
  color?: string;
  /** If `true`, centre-aligns the text. */
  center?: boolean;
  /** Renders the text in the colour used for copy on a dark surface. */
  onInk?: boolean;
  /** Dims to the secondary text colour — shorthand for the common case. */
  muted?: boolean;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Colour resolution
//
// Four measured paths, and no fifth. Screens either name a colour or reach for
// one of these two flags, so the whole app's copy sits on the same four values:
//
//   default            ink 900   on paper  — 16.40:1
//   muted              #4F5468   on paper  —  7.10:1
//   onInk              #EDE7DD   on ink900 — 14.09:1
//   onInk + muted      #A6ABC4   on ink900 —  7.63:1
//
// The muted pair matters most: a "quiet" colour is exactly where a palette
// usually slips under AA, and both of these clear it with room to spare.
// ---------------------------------------------------------------------------

function resolveColor(onInk?: boolean, muted?: boolean): string {
  if (onInk) return muted ? colors.text.onInkMuted : colors.text.onInk;
  return muted ? colors.text.secondary : colors.text.primary;
}

/**
 * Marigold is the app's single voice and it is a **surface, never a label**.
 *
 * `#F0A03A` measures 2.03:1 on paper and `#FBD9A4` 1.35:1 — neither can carry
 * text at any size. The readable form is `colors.text.accent` (`#9C5A10`,
 * 5.12:1). This is the one palette rule that gets broken by accident, because
 * marigold is the colour everyone reaches for when they want emphasis, so it is
 * worth a development-time warning rather than a comment nobody reads.
 */
function warnIfUnreadable(color: string | undefined): void {
  if (!__DEV__ || !color) return;
  if (color === colors.primary.amber || color === colors.primary.amberLight) {
    console.warn(
      `[Text] Marigold ${color} cannot carry text (2.03:1 on paper). ` +
        'Use colors.text.accent (#9C5A10, 5.12:1) for accent copy, and keep ' +
        'marigold for surfaces.',
    );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Text>` — themed text.
 *
 * Picks the family, size, line height, tracking and case for the chosen
 * variant, so a screen never sets a font by hand.
 *
 * ```tsx
 * <Text variant="h1">Aarav's week</Text>
 * <Text variant="editorial" muted>Three years and two months old.</Text>
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

  warnIfUnreadable(colorProp);

  const resolvedColor = colorProp ?? resolveColor(onInk, muted);

  const merged: StyleProp<RNTextStyle> = [
    {
      fontFamily: typographyStyle.fontFamily,
      fontSize: typographyStyle.fontSize,
      lineHeight: typographyStyle.lineHeight,
      // Forwarded rather than assumed: a variant that ever carries a weight
      // should not have it silently dropped here.
      fontWeight: typographyStyle.fontWeight as RNTextStyle['fontWeight'],
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
