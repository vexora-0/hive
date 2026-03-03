/**
 * Hive Spacing Scale
 *
 * Built on a 4px grid for consistent, harmonious layouts.
 */

export const spacing = {
  /** 4px — hairline gaps, icon padding */
  xs: 4,
  /** 8px — tight spacing between related elements */
  sm: 8,
  /** 16px — default content padding */
  md: 16,
  /** 24px — section spacing */
  lg: 24,
  /** 32px — large section gaps */
  xl: 32,
  /** 48px — major layout divisions */
  xxl: 48,
} as const;

/** Helper: returns a spacing value multiplied by n base units (4px each). */
export const grid = (n: number): number => n * 4;

/** Common layout-specific spacing presets. */
export const layout = {
  /** Horizontal padding for screen content */
  screenPaddingHorizontal: spacing.md,
  /** Vertical padding for screen content */
  screenPaddingVertical: spacing.lg,
  /** Gap between cards in a feed list */
  cardGap: spacing.sm,
  /** Inner padding for cards */
  cardPadding: spacing.md,
  /** Radius that pairs with card padding */
  cardRadius: 16,
  /** Standard border radius for buttons */
  buttonRadius: 12,
  /** Standard border radius for inputs */
  inputRadius: 12,
  /** Standard border radius for avatars / circles */
  avatarRadius: 9999,
} as const;

export type Spacing = typeof spacing;
export type Layout = typeof layout;
