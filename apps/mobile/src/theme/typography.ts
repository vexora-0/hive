/**
 * Hive Typography
 *
 * Headings use Baloo 2 (bold, rounded, playful).
 * Body text uses Nunito (friendly, highly legible).
 *
 * Font files must be loaded via expo-font or @expo-google-fonts before use.
 */

// ── Font Families ────────────────────────────────────────────────────

export const fontFamily = {
  heading: 'Baloo2_700Bold',
  bodyRegular: 'Nunito_400Regular',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

// ── Font Sizes ───────────────────────────────────────────────────────

export const fontSize = {
  h1: 32,
  h2: 26,
  h3: 22,
  h4: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  tiny: 10,
} as const;

// ── Line Heights (≈ 1.4× font size, rounded to even numbers) ────────

export const lineHeight = {
  h1: 44,
  h2: 36,
  h3: 30,
  h4: 26,
  body: 24,
  bodySmall: 20,
  caption: 18,
  tiny: 14,
} as const;

// ── Pre-composed Text Styles ─────────────────────────────────────────

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodyBold'
  | 'bodySmall'
  | 'bodySmallBold'
  | 'caption'
  | 'captionBold'
  | 'tiny';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight?: string;
}

/**
 * Returns the correct fontFamily (and associated size / lineHeight)
 * for a given typography variant.
 *
 * Usage:
 * ```ts
 * const style = getTextStyle('h1');
 * // { fontFamily: 'Baloo2_700Bold', fontSize: 32, lineHeight: 44 }
 * ```
 */
export function getTextStyle(variant: TypographyVariant): TextStyle {
  switch (variant) {
    // ── Headings (Baloo 2 Bold) ──
    case 'h1':
      return { fontFamily: fontFamily.heading, fontSize: fontSize.h1, lineHeight: lineHeight.h1 };
    case 'h2':
      return { fontFamily: fontFamily.heading, fontSize: fontSize.h2, lineHeight: lineHeight.h2 };
    case 'h3':
      return { fontFamily: fontFamily.heading, fontSize: fontSize.h3, lineHeight: lineHeight.h3 };
    case 'h4':
      return { fontFamily: fontFamily.heading, fontSize: fontSize.h4, lineHeight: lineHeight.h4 };

    // ── Body (Nunito) ──
    case 'body':
      return { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.body, lineHeight: lineHeight.body };
    case 'bodyBold':
      return { fontFamily: fontFamily.bodyBold, fontSize: fontSize.body, lineHeight: lineHeight.body };
    case 'bodySmall':
      return { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.bodySmall, lineHeight: lineHeight.bodySmall };
    case 'bodySmallBold':
      return { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.bodySmall, lineHeight: lineHeight.bodySmall };

    // ── Captions & Tiny ──
    case 'caption':
      return { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.caption, lineHeight: lineHeight.caption };
    case 'captionBold':
      return { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.caption, lineHeight: lineHeight.caption };
    case 'tiny':
      return { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.tiny, lineHeight: lineHeight.tiny };
  }
}

/** Map of every variant to its pre-composed text style — handy for StyleSheet.create(). */
export const textStyles: Record<TypographyVariant, TextStyle> = {
  h1: getTextStyle('h1'),
  h2: getTextStyle('h2'),
  h3: getTextStyle('h3'),
  h4: getTextStyle('h4'),
  body: getTextStyle('body'),
  bodyBold: getTextStyle('bodyBold'),
  bodySmall: getTextStyle('bodySmall'),
  bodySmallBold: getTextStyle('bodySmallBold'),
  caption: getTextStyle('caption'),
  captionBold: getTextStyle('captionBold'),
  tiny: getTextStyle('tiny'),
};

export type Typography = typeof textStyles;
