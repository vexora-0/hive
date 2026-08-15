/**
 * Hive Color Palette — "Marigold & Ink"
 *
 * The app is a keepsake: the album a family keeps of a child's first school
 * years. So the ground is paper, the structure is ink, and marigold is the one
 * colour that acts. Everything else is a quiet supporting voice.
 *
 * **A comment cannot enforce a hierarchy; chroma tiers can.** The previous
 * palette said "one accent per screen" in prose while shipping five accents at
 * flat chroma (marigold C*65.8, rose 50.3, plum 44.5, leaf 38.9, peacock 26.7)
 * — so no colour was the protagonist. Worse, three of them could not legally
 * carry text: rose measured 3.05:1, leaf 3.23:1, `warning.main` 2.54:1 and
 * `error.main` 4.04:1 on paper. The hierarchy now lives in the values:
 *
 * | Tier | Role                                   | Chroma  | Constraint            |
 * |------|----------------------------------------|---------|-----------------------|
 * | 1    | Marigold — the voice                   | C* > 60 | **Surface only**      |
 * | 2    | Accent text, success / warning / error | C* 34–57| ≥ 4.5:1 on paper      |
 * | 3    | Identity and role markers              | C* 20–36| ≥ 4.5:1 on paper      |
 * | 4    | Ink ramp, greys, borders               | C* ≤ 13 | —                     |
 *
 * Two rules follow from it:
 *
 *  1. **Marigold is a surface, never a label.** `#F0A03A` is 2.03:1 on paper —
 *     it cannot carry text. Primary buttons are marigold filled with *ink*
 *     (8.08:1), which is both accessible and the letterpress look we want.
 *     When an accent must be read as text, use `text.accent` (5.12:1).
 *  2. **Every `.main` in this file is text-grade.** If a value is here, you may
 *     set type in it. That is a change from the previous palette, where the
 *     `.main` tier was decorative and quietly failed AA.
 *
 * Key names are deliberately unchanged so the whole app re-skins from this
 * file. Only the values moved. Figures marked below were computed in CIE LCh
 * and WCAG contrast against `paper.page`, not estimated.
 */

// ── Ink — the album cover. Dark surfaces, headings, text on paper. ────
//
// The previous ramp let chroma climb from C*15.8 to C*25.9, which is why large
// ink surfaces read as saturated navy rather than as charcoal with a cast. The
// closest premium comparator (Tinybeans) sits at C*7.7. This ramp holds
// H≈286 and C* ≤ 9.3 across every stop while keeping Hive's depth.
const ink = {
  /** L*9.5 C*7.5 H285.7 · 16.40:1 on paper · 8.08:1 under ink-on-marigold */
  900: '#181A24',
  /** L*15.4 C*8.5 · 14.21:1 */
  800: '#242632',
  /** L*21.5 C*8.8 · 11.84:1 */
  700: '#313340',
  /** L*29.1 C*9.1 · 9.14:1 */
  600: '#414452',
  /** L*36.9 C*9.3 · 6.86:1 */
  500: '#545665',
} as const;

// ── Paper — the page. Warm, low-chroma, easy under a classroom light. ─
//
// Measured against the comparators and left alone: L*97.8 C*4.0 H83 sits
// inside the band held by Tinybeans (#fcf8f5) and Famly (#F7F6F2) on all three
// coordinates. Pure #FFF reads as an unstyled default.
const paper = {
  page: '#FDF8F1',
  raised: '#FFFFFF',
  sunk: '#F4EDE2',
  edge: '#E9DFD0',
} as const;

export const colors = {
  // ── Primary accents ────────────────────────────────────────────────
  // `amber` is tier 1 and the only thing in it: CTAs, active tabs, focus.
  // The other four are tier 3 — role and identity markers, demoted to a
  // chroma that lets them carry text. They are not decoration.
  primary: {
    /** Marigold — the single acting accent. C*65.8. **Surface only, never text.** */
    amber: '#F0A03A',
    amberLight: '#FBD9A4',
    /** The readable marigold — 5.12:1. Safe for text, icons and indicators. */
    amberDark: '#9C5A10',
    /** Wash — tinted background for marigold-owned regions. */
    amberWash: '#FDF0DC',

    /** Peacock — information, teacher role, links. C*20.2 · 5.70:1 */
    blue: '#2E6B77',
    blueLight: '#A9D6DE',
    blueDark: '#22525C',
    blueWash: '#E4F2F4',

    /** Leaf — growth, success, completed states. C*27.3 · 5.24:1 */
    mint: '#3F7355',
    mintLight: '#BEE0CB',
    mintDark: '#2E5941',
    mintWash: '#E8F4EC',

    /** Plum — admin role, secondary emphasis. C*26.8 · 5.82:1 */
    lavender: '#6A5A85',
    lavenderLight: '#CFC0E4',
    lavenderDark: '#524566',
    lavenderWash: '#F0EAF7',

    /** Rose — affection: favourites, hearts, a child's own colour. C*35.2 · 5.30:1 */
    rose: '#9E4F63',
    roseLight: '#F6C9D6',
    roseDark: '#7D3D4D',
    roseWash: '#FCEAF0',
  },

  // ── Ink scale ──────────────────────────────────────────────────────
  ink,

  // ── Backgrounds ────────────────────────────────────────────────────
  background: {
    /** The page. Every screen sits on this. */
    cream: paper.page,
    /** Cards and sheets lifted off the page. */
    surface: paper.raised,
    /** Recessed wells — input fields, inactive segments, image placeholders. */
    surfaceSecondary: paper.sunk,
    /** Dark surfaces — tab bar, hero panels. **Not** the photo viewer. */
    navyDark: ink[900],
    navyMedium: ink[700],
  },

  /** Alias of `background`, named for what each value is rather than its hue. */
  surface: {
    page: paper.page,
    raised: paper.raised,
    sunk: paper.sunk,
    ink: ink[900],
    inkRaised: ink[700],
  },

  /**
   * Immersive — the ground a photograph sits on, and nothing else.
   *
   * Ink is C*7.5 violet. A tinted surround measurably shifts the apparent white
   * balance of the photograph inside it, so anything that exists to show a
   * photo full-bleed gets a near-neutral ground instead.
   *
   * **Applies to:** photo viewer, photo-first hero, lightbox.
   * **Does not apply to:** tab bar, ink panels — those keep `ink[900]`.
   */
  viewer: {
    /** L*3.0 C*0.44 — near-neutral, so it does not tint the photograph. */
    ground: '#0B0B0C',
    /** Gradient foot under a photo caption. White on it measures 10.37:1. */
    foot: 'rgba(11, 11, 12, 0.55)',
  },

  // ── Grays — warm-tinted so they sit on paper, not beside it. ────────
  gray: {
    50: '#FBF8F4',
    100: '#F5F0E9',
    200: '#EAE3D9',
    300: '#DBD3C6',
    400: '#B8B2A6',
    500: '#918C82',
    /** 4.64:1 — the lightest grey that may carry text on paper. */
    600: '#6B7085',
    700: '#4F5468',
    800: '#33374A',
    900: ink[900],
  },

  // ── Text ───────────────────────────────────────────────────────────
  // Every value below clears 4.5:1 on `background.cream`.
  text: {
    primary: ink[900],
    /** 7.10:1 */
    secondary: '#4F5468',
    /** 4.64:1 — **the floor.** Nothing lighter carries text on paper. */
    tertiary: '#6B7085',
    inverse: '#FFFFFF',
    /** Body text on an ink surface — 14.09:1 on `ink.900`. */
    onInk: '#EDE7DD',
    /** Secondary text on an ink surface — 7.63:1 on `ink.900`. */
    onInkMuted: '#A6ABC4',
    /** 7.40:1 */
    link: '#0F5A69',
    /** The readable form of marigold, for accent *text* on paper — 5.12:1. */
    accent: '#9C5A10',
  },

  // ── Semantic / Status ──────────────────────────────────────────────
  // `main` is text-grade in every one of these. The previous values were not:
  // success 3.23:1, warning 2.54:1, error 4.04:1. They now live at `light`,
  // which is a fill and makes no claim to legibility.
  success: {
    /** C*34.3 · 5.62:1 on paper · 5.26:1 on `background` */
    main: '#2F7049',
    light: '#BEE0CB',
    dark: '#245A39',
    background: '#E8F4EC',
  },

  warning: {
    /** C*52.5 · 6.10:1 on paper · 5.82:1 on `background` */
    main: '#8A5100',
    light: '#F8DCB0',
    dark: '#6B3F00',
    background: '#FDF2E0',
  },

  error: {
    /** C*56.6 · 6.67:1 on paper · 6.07:1 on `background` */
    main: '#A32E2A',
    light: '#F4C4C2',
    dark: '#82211E',
    background: '#FCEAE9',
  },

  info: {
    /** C*20.2 · 5.70:1 on paper · 5.25:1 on `background` */
    main: '#2E6B77',
    light: '#A9D6DE',
    dark: '#22525C',
    background: '#E4F2F4',
  },

  // ── Overlays & Borders ─────────────────────────────────────────────
  overlay: {
    light: 'rgba(255, 253, 249, 0.72)',
    medium: 'rgba(24, 26, 36, 0.45)',
    dark: 'rgba(24, 26, 36, 0.72)',
    /** Behind sheets and dialogs. */
    scrim: 'rgba(24, 26, 36, 0.55)',
    /** Gradient foot under photo captions. Alias of `viewer.foot`. */
    photoFoot: 'rgba(11, 11, 12, 0.55)',
  },

  border: {
    light: paper.edge,
    default: '#DDD1BE',
    dark: '#C0B3A0',
    /** Hairline on an ink surface. */
    onInk: 'rgba(237, 231, 221, 0.16)',
  },

  // ── Misc ───────────────────────────────────────────────────────────
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Colors = typeof colors;

/**
 * The accent that identifies each role, used for avatars, badges and the one
 * coloured element a role's screens are allowed.
 */
export const roleAccent = {
  parent: colors.primary.rose,
  teacher: colors.primary.blue,
  admin: colors.primary.lavender,
} as const;

/**
 * Deterministic accent for a person or child, so the same name always gets the
 * same colour everywhere in the app.
 *
 * Each entry is a trio rather than one hex, because a name needs three things:
 * a wash to sit on, a deep tone dark enough to be read as text on that wash,
 * and the saturated hue itself for rings and dots.
 *
 * `hue` and `ink` are now the same tier-3 value in four of five entries: a ring
 * drawn in a colour too light to have been text was the same failure as the
 * text itself, one step removed.
 */
export interface IdentityPalette {
  /** Background wash. */
  wash: string;
  /** Text and initials on `wash` — every one clears 4.5:1. */
  ink: string;
  /** The saturated hue, for rings, dots and accents. */
  hue: string;
}

const IDENTITY_PALETTES: readonly IdentityPalette[] = [
  // marigold — 4.81:1 on its wash
  { wash: '#FDF0DC', ink: '#9C5A10', hue: '#F0A03A' },
  // peacock — 5.25:1
  { wash: '#E4F2F4', ink: '#2E6B77', hue: '#2E6B77' },
  // leaf — 4.90:1
  { wash: '#E8F4EC', ink: '#3F7355', hue: '#3F7355' },
  // plum — 5.22:1
  { wash: '#F0EAF7', ink: '#6A5A85', hue: '#6A5A85' },
  // rose — 4.84:1
  { wash: '#FCEAF0', ink: '#9E4F63', hue: '#9E4F63' },
];

function identityIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % IDENTITY_PALETTES.length;
}

export function identityPalette(seed: string): IdentityPalette {
  return IDENTITY_PALETTES[identityIndex(seed)];
}

/** The saturated hue only — for rings, dots and single-colour accents. */
export function identityColor(seed: string): string {
  return IDENTITY_PALETTES[identityIndex(seed)].hue;
}

/** Adds an alpha channel to a 6-digit hex colour. `alpha` is 0–1. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${suffix}`;
}
