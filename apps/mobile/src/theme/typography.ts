/**
 * Hive Typography — Fraunces & Plus Jakarta Sans
 *
 * Two voices, split by job rather than by size:
 *
 *  - **Fraunces** (display, 600) carries the editorial moments — screen
 *    titles, a child's name, an order total. It is a soft serif: warm enough
 *    for a preschool, cut well enough to read as printed rather than
 *    cartoonish. It is used sparingly, and never below 18px, where its detail
 *    turns to mud.
 *  - **Plus Jakarta Sans** does all the work — body, labels, buttons, numbers.
 *    It has a proper ₹ glyph and holds up at 10px on a bright classroom
 *    screen.
 *
 * The previous system set every heading in Baloo 2, a rounded display face
 * doing duty from 32px down to 18px. That single choice is what made the app
 * read as a toy. Restricting the display face to three sizes and handing the
 * rest to a neutral sans is most of the change.
 *
 * **The shipped Fraunces is not variable.** The TTF has no `fvar` — it is a
 * static instance pinned at SOFT=0 ("Sharp") and WONK=0 ("NonWonky"). The
 * "wonky terminals" a previous version of this comment described are not
 * rendering, and SOFT/WONK/opsz cannot be tuned at runtime; changing the cut
 * means shipping a different static file.
 *
 * ── Two measured corrections ──────────────────────────────────────────
 *
 * **1. The h3→h4 handover was optically flat.** Fraunces has an x-height ratio
 * of 0.482 against Plus Jakarta's 0.536, so Jakarta runs 11.2% larger at the
 * same nominal size. The old pair — Fraunces 20 to Jakarta 17 — looked like a
 * 17.6% step on paper but measured **5.8%** in x-height, which is why the
 * sub-heading level read weak. h3 at 22 takes it to **16.4%**.
 *
 * **2. Display type needs negative tracking, and RN measures it in points.**
 * `letterSpacing` is absolute, not em, so a single value cannot serve every
 * size — it has to be scaled per step. Below 20px nothing gets negative
 * tracking, where it would close up the counters instead of tightening the
 * line.
 */

// ── Font Families ────────────────────────────────────────────────────

export const fontFamily = {
  /** Fraunces SemiBold — screen titles and hero numbers. */
  display: 'Fraunces_600SemiBold',
  /** Fraunces Bold — reserved for the single largest thing on a screen. */
  displayBold: 'Fraunces_700Bold',
  /**
   * Fraunces Light — large and airy, for a hero that is a *statement* rather
   * than a label. **≥32px only**: at 22px on a classroom-lit phone a 300 weight
   * thins out and loses the serifs that make it Fraunces.
   */
  displayLight: 'Fraunces_300Light',
  /**
   * Fraunces Italic — the editorial voice. **Exactly one line per screen**: a
   * child's name, a memory date, the sentence in an empty state. It adds warmth
   * without spending the display face, which is why it is a separate cut rather
   * than a style flag.
   */
  displayItalic: 'Fraunces_400Regular_Italic',

  /** Kept for compatibility: `heading` is the display face. */
  heading: 'Fraunces_600SemiBold',

  bodyRegular: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

// ── Font Sizes ───────────────────────────────────────────────────────

export const fontSize = {
  display: 40,
  h1: 32,
  h2: 25,
  /** 22, not 20 — see the x-height note above. */
  h3: 22,
  h4: 17,
  /** The italic accent line. 18 is Fraunces's floor. */
  editorial: 18,
  body: 16,
  bodySmall: 14,
  label: 13,
  caption: 12,
  eyebrow: 11,
  tiny: 10,
  price: 20,
  priceLarge: 30,
} as const;

// ── Line Heights ─────────────────────────────────────────────────────
// Tight on display sizes, generous on body — the ratio is what makes a
// screen feel considered rather than merely spaced out.

export const lineHeight = {
  display: 44,
  h1: 38,
  h2: 31,
  h3: 28,
  h4: 23,
  editorial: 26,
  body: 25,
  bodySmall: 21,
  label: 18,
  caption: 17,
  eyebrow: 14,
  tiny: 13,
  price: 26,
  priceLarge: 36,
} as const;

// ── Pre-composed Text Styles ─────────────────────────────────────────

/**
 * Negative tracking, in points, keyed by the size it belongs to.
 *
 * RN's `letterSpacing` is absolute, so this cannot be one number. The ramp is
 * roughly -0.05em at the top, easing to zero as the size comes down. **Nothing
 * below 20px appears here** — tightening a 17px label closes its counters
 * rather than tidying the line, and it is the fastest way to make a screen feel
 * cramped.
 */
export const tracking = {
  /** 40px */
  display: -2.0,
  /** 32px */
  h1: -1.6,
  /** 25px */
  h2: -1.0,
  /** 22px */
  h3: -0.9,
  /** 30px, tabular */
  priceLarge: -1.2,
  /** 20px, tabular */
  price: -0.3,
} as const;

export type TypographyVariant =
  | 'display'
  | 'displayLight'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'editorial'
  | 'body'
  | 'bodyMedium'
  | 'bodyBold'
  | 'bodySmall'
  | 'bodySmallBold'
  | 'label'
  | 'caption'
  | 'captionBold'
  | 'eyebrow'
  | 'tiny'
  | 'price'
  | 'priceLarge';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight?: string;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontVariant?: ('tabular-nums' | 'lining-nums')[];
}

/**
 * Returns the composed style for a typography variant.
 *
 * ```ts
 * const style = getTextStyle('h1');
 * // { fontFamily: 'Fraunces_600SemiBold', fontSize: 32, lineHeight: 38, letterSpacing: -0.6 }
 * ```
 */
export function getTextStyle(variant: TypographyVariant): TextStyle {
  switch (variant) {
    // ── Display voice (Fraunces) ──
    case 'display':
      return {
        fontFamily: fontFamily.displayBold,
        fontSize: fontSize.display,
        lineHeight: lineHeight.display,
        letterSpacing: tracking.display,
      };
    /** The airy hero. Light only survives at this size — see `displayLight`. */
    case 'displayLight':
      return {
        fontFamily: fontFamily.displayLight,
        fontSize: fontSize.display,
        lineHeight: lineHeight.display,
        letterSpacing: tracking.display,
      };
    case 'h1':
      return {
        fontFamily: fontFamily.display,
        fontSize: fontSize.h1,
        lineHeight: lineHeight.h1,
        letterSpacing: tracking.h1,
      };
    case 'h2':
      return {
        fontFamily: fontFamily.display,
        fontSize: fontSize.h2,
        lineHeight: lineHeight.h2,
        letterSpacing: tracking.h2,
      };
    case 'h3':
      return {
        fontFamily: fontFamily.display,
        fontSize: fontSize.h3,
        lineHeight: lineHeight.h3,
        letterSpacing: tracking.h3,
      };

    /**
     * The one italic line a screen is allowed. Not a heading level — reach for
     * it when a sentence should sound like it was written rather than
     * generated.
     */
    case 'editorial':
      return {
        fontFamily: fontFamily.displayItalic,
        fontSize: fontSize.editorial,
        lineHeight: lineHeight.editorial,
      };

    // ── UI voice (Plus Jakarta Sans) ──
    // h4 hands over to the sans: below 20px Fraunces stops being legible at a
    // glance, which is the only thing a sub-heading has to do. No negative
    // tracking from here down.
    case 'h4':
      return {
        fontFamily: fontFamily.bodyBold,
        fontSize: fontSize.h4,
        lineHeight: lineHeight.h4,
      };

    case 'body':
      return {
        fontFamily: fontFamily.bodyRegular,
        fontSize: fontSize.body,
        lineHeight: lineHeight.body,
      };
    case 'bodyMedium':
      return {
        fontFamily: fontFamily.bodyMedium,
        fontSize: fontSize.body,
        lineHeight: lineHeight.body,
      };
    case 'bodyBold':
      return {
        fontFamily: fontFamily.bodySemiBold,
        fontSize: fontSize.body,
        lineHeight: lineHeight.body,
      };
    case 'bodySmall':
      return {
        fontFamily: fontFamily.bodyRegular,
        fontSize: fontSize.bodySmall,
        lineHeight: lineHeight.bodySmall,
      };
    case 'bodySmallBold':
      return {
        fontFamily: fontFamily.bodySemiBold,
        fontSize: fontSize.bodySmall,
        lineHeight: lineHeight.bodySmall,
      };
    case 'label':
      return {
        fontFamily: fontFamily.bodySemiBold,
        fontSize: fontSize.label,
        lineHeight: lineHeight.label,
        letterSpacing: 0.1,
      };

    // ── Captions & structural marks ──
    case 'caption':
      return {
        fontFamily: fontFamily.bodyRegular,
        fontSize: fontSize.caption,
        lineHeight: lineHeight.caption,
      };
    case 'captionBold':
      return {
        fontFamily: fontFamily.bodySemiBold,
        fontSize: fontSize.caption,
        lineHeight: lineHeight.caption,
      };
    /**
     * The one structural device in the system: a spaced, uppercase mark that
     * names a region. It is used where a region genuinely needs naming, not as
     * decoration above every heading.
     */
    case 'eyebrow':
      return {
        fontFamily: fontFamily.bodyBold,
        fontSize: fontSize.eyebrow,
        lineHeight: lineHeight.eyebrow,
        letterSpacing: 1.3,
        textTransform: 'uppercase',
      };
    case 'tiny':
      return {
        fontFamily: fontFamily.bodySemiBold,
        fontSize: fontSize.tiny,
        lineHeight: lineHeight.tiny,
        letterSpacing: 0.2,
      };

    // ── Money ──
    // Tabular figures so a column of rupee amounts lines up on the decimal.
    case 'price':
      return {
        fontFamily: fontFamily.bodyBold,
        fontSize: fontSize.price,
        lineHeight: lineHeight.price,
        letterSpacing: tracking.price,
        fontVariant: ['tabular-nums'],
      };
    case 'priceLarge':
      return {
        fontFamily: fontFamily.display,
        fontSize: fontSize.priceLarge,
        lineHeight: lineHeight.priceLarge,
        letterSpacing: tracking.priceLarge,
        fontVariant: ['tabular-nums'],
      };
  }
}

/** Every variant pre-composed — handy inside `StyleSheet.create()`. */
export const textStyles: Record<TypographyVariant, TextStyle> = {
  display: getTextStyle('display'),
  displayLight: getTextStyle('displayLight'),
  h1: getTextStyle('h1'),
  h2: getTextStyle('h2'),
  h3: getTextStyle('h3'),
  h4: getTextStyle('h4'),
  editorial: getTextStyle('editorial'),
  body: getTextStyle('body'),
  bodyMedium: getTextStyle('bodyMedium'),
  bodyBold: getTextStyle('bodyBold'),
  bodySmall: getTextStyle('bodySmall'),
  bodySmallBold: getTextStyle('bodySmallBold'),
  label: getTextStyle('label'),
  caption: getTextStyle('caption'),
  captionBold: getTextStyle('captionBold'),
  eyebrow: getTextStyle('eyebrow'),
  tiny: getTextStyle('tiny'),
  price: getTextStyle('price'),
  priceLarge: getTextStyle('priceLarge'),
};

export type Typography = typeof textStyles;
