/**
 * Hive Spacing & Radius
 *
 * Spacing is a 4px grid. Radius is deliberately *not* a smooth ramp: the
 * system uses two families that contrast with each other, and that contrast is
 * a structural signature rather than an accident.
 *
 *  - **Soft** (18–28) — anything that holds interface: cards, sheets, buttons,
 *    pills. Generously rounded, which is where the warmth comes from.
 *  - **Sharp** (4–6) — anything that holds a photograph. A print has square
 *    corners. Rounding a child's photo to match the buttons around it is what
 *    made the old feed read as a template.
 *
 * Putting a 6px image inside a 20px card is the whole idea.
 */

export const spacing = {
  /** 2px — optical nudges */
  xxs: 2,
  /** 4px — hairline gaps, icon padding */
  xs: 4,
  /** 8px — tight spacing between related elements */
  sm: 8,
  /** 12px — inside compact controls */
  ms: 12,
  /** 16px — default content padding */
  md: 16,
  /** 24px — section spacing */
  lg: 24,
  /** 32px — large section gaps */
  xl: 32,
  /** 48px — major layout divisions */
  xxl: 48,
  /** 64px — hero breathing room */
  xxxl: 64,
} as const;

/** Helper: returns a spacing value multiplied by n base units (4px each). */
export const grid = (n: number): number => n * 4;

// ── Radius ───────────────────────────────────────────────────────────

export const radius = {
  /** 0 — full-bleed edges */
  none: 0,
  /** 4px — the image inside a photo mount */
  print: 4,
  /** 6px — the photo mount itself */
  mount: 6,
  /** 10px — chips, tags, small badges */
  xs: 10,
  /** 14px — inputs and inline controls */
  sm: 14,
  /** 18px — buttons */
  md: 18,
  /** 22px — cards and list rows */
  lg: 22,
  /** 28px — bottom sheets, hero panels */
  xl: 28,
  /** 36px — the floating tab bar */
  xxl: 36,
  /** fully round */
  pill: 999,
} as const;

/** Common layout-specific presets. */
export const layout = {
  /** Horizontal padding for screen content */
  screenPaddingHorizontal: spacing.lg,
  /** Vertical padding for screen content */
  screenPaddingVertical: spacing.lg,
  /** Gap between cards in a feed list */
  cardGap: spacing.ms,
  /** Inner padding for cards */
  cardPadding: spacing.md,
  /** Radius that pairs with card padding */
  cardRadius: radius.lg,
  /** Standard border radius for buttons */
  buttonRadius: radius.md,
  /** Standard border radius for inputs */
  inputRadius: radius.sm,
  /** Standard border radius for avatars / circles */
  avatarRadius: radius.pill,
  /** Bottom sheets and dialogs */
  sheetRadius: radius.xl,
  /** Height of the floating tab bar's own body, excluding safe-area inset */
  tabBarHeight: 62,
  /** How far the floating tab bar sits in from the screen edge */
  tabBarInset: spacing.md,
  /** Bottom padding lists need so content clears the floating tab bar */
  tabBarClearance: 62 + spacing.md + spacing.md,
  /** Hairline used for rules and dividers */
  hairline: 1,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Layout = typeof layout;
