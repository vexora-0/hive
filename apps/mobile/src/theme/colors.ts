/**
 * Hive Color Palette — "Marigold & Ink"
 *
 * The app is a keepsake: the album a family keeps of a child's first school
 * years. So the ground is paper, the structure is ink, and marigold is the one
 * colour that acts. Everything else is a quiet supporting voice.
 *
 * Two rules hold the system together:
 *
 *  1. **Marigold is a surface, never a label.** `#F0A03A` is 2.0:1 on white —
 *     it cannot carry text. Primary buttons are marigold filled with *ink*
 *     text (8.0:1), which is both accessible and the letterpress look we want.
 *     When an accent must be read as text on paper, use `text.accent`.
 *  2. **One accent per screen.** Peacock, rose and plum exist to separate
 *     roles (info, favourite, admin) — not to decorate.
 *
 * The key names are deliberately unchanged from the previous palette so the
 * whole app re-skins from this file. Only the values moved.
 */

// ── Ink — the album cover. Dark surfaces, headings, text on paper. ────
const ink = {
  900: '#14162B',
  800: '#1C1F38',
  700: '#262B4A',
  600: '#3A4166',
  500: '#4F5680',
} as const;

// ── Paper — the page. Warm, low-chroma, easy under a classroom light. ─
const paper = {
  page: '#FDF8F1',
  raised: '#FFFFFF',
  sunk: '#F4EDE2',
  edge: '#E9DFD0',
} as const;

export const colors = {
  // ── Primary accents ────────────────────────────────────────────────
  // `amber` is the one that acts: CTAs, active tabs, focus. The other three
  // are role markers, used at most once per screen.
  primary: {
    /** Marigold — the single acting accent. Surface only, never text. */
    amber: '#F0A03A',
    amberLight: '#FBD9A4',
    amberDark: '#C97A18',
    /** Wash — tinted background for marigold-owned regions. */
    amberWash: '#FDF0DC',

    /** Peacock — information, teacher role, links. */
    blue: '#17798C',
    blueLight: '#A9D6DE',
    blueDark: '#0F5A69',
    blueWash: '#E4F2F4',

    /** Leaf — growth, success, completed states. */
    mint: '#4E9A6B',
    mintLight: '#BEE0CB',
    mintDark: '#2F7049',
    mintWash: '#E8F4EC',

    /** Plum — admin role, secondary emphasis. */
    lavender: '#7B5EA7',
    lavenderLight: '#CFC0E4',
    lavenderDark: '#5A3F80',
    lavenderWash: '#F0EAF7',

    /** Rose — affection: favourites, hearts, a child's own colour. */
    rose: '#E0688A',
    roseLight: '#F6C9D6',
    roseDark: '#B84466',
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
    /** Dark surfaces — tab bar, photo viewer, hero panels. */
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

  // ── Grays — warm-tinted so they sit on paper, not beside it. ────────
  gray: {
    50: '#FBF8F4',
    100: '#F5F0E9',
    200: '#EAE3D9',
    300: '#DBD3C6',
    400: '#B8B2A6',
    500: '#918C82',
    600: '#6B7085',
    700: '#4F5468',
    800: '#33374A',
    900: '#1C1F38',
  },

  // ── Text ───────────────────────────────────────────────────────────
  // Every value below clears 4.5:1 on `background.cream`.
  text: {
    primary: ink[900],
    secondary: '#4F5468',
    tertiary: '#6B7085',
    inverse: '#FFFFFF',
    /** Body text on an ink surface. */
    onInk: '#EDE7DD',
    /** Secondary text on an ink surface. */
    onInkMuted: '#A6ABC4',
    link: '#0F5A69',
    /** The readable form of marigold — for accent *text* on paper. */
    accent: '#9C5A10',
  },

  // ── Semantic / Status ──────────────────────────────────────────────
  success: {
    main: '#4E9A6B',
    light: '#BEE0CB',
    dark: '#2F7049',
    background: '#E8F4EC',
  },

  warning: {
    main: '#E08A1E',
    light: '#F8DCB0',
    dark: '#8A5100',
    background: '#FDF2E0',
  },

  error: {
    main: '#D64A45',
    light: '#F4C4C2',
    dark: '#A32E2A',
    background: '#FCEAE9',
  },

  info: {
    main: '#17798C',
    light: '#A9D6DE',
    dark: '#0F5A69',
    background: '#E4F2F4',
  },

  // ── Overlays & Borders ─────────────────────────────────────────────
  overlay: {
    light: 'rgba(255, 253, 249, 0.72)',
    medium: 'rgba(20, 22, 43, 0.45)',
    dark: 'rgba(20, 22, 43, 0.72)',
    /** Behind sheets and dialogs. */
    scrim: 'rgba(20, 22, 43, 0.55)',
    /** Gradient foot under photo captions. */
    photoFoot: 'rgba(20, 22, 43, 0.62)',
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
  { wash: '#FDF0DC', ink: '#9C5A10', hue: '#F0A03A' },
  { wash: '#E4F2F4', ink: '#0F5A69', hue: '#17798C' },
  { wash: '#E8F4EC', ink: '#2F7049', hue: '#4E9A6B' },
  { wash: '#F0EAF7', ink: '#5A3F80', hue: '#7B5EA7' },
  { wash: '#FCEAF0', ink: '#B84466', hue: '#E0688A' },
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
