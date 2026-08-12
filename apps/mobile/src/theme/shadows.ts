/**
 * Hive Elevation
 *
 * Shadows are cast by warm light onto warm paper, so they are brown rather
 * than blue-black, wide rather than tight, and much softer than the previous
 * set. A tight dark shadow reads as a UI card floating in space; a wide warm
 * one reads as a print resting on a page, which is the whole premise.
 *
 * Each preset carries iOS shadow properties and the matching Android
 * elevation. Use `platformShadow()` when you need only what the platform
 * actually honours.
 */

import { Platform, ViewStyle } from 'react-native';

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** Warm umber — the colour of a shadow on cream paper, not on white plastic. */
const SHADOW_COLOR = '#5C4326';

/** Ink shadow, for elements lifted off a dark surface. */
const SHADOW_COLOR_INK = '#0A0B16';

/**
 * Small — list rows, chips, input fields at rest.
 * Barely there: it separates, it does not lift.
 */
export const shadowSmall: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

/** Medium — cards and photo mounts resting on the page. */
export const shadowMedium: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 5,
};

/** Large — the floating tab bar, FABs, popovers. */
export const shadowLarge: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.16,
  shadowRadius: 28,
  elevation: 10,
};

/** Extra large — bottom sheets and dialogs over a scrim. */
export const shadowXLarge: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: 0.22,
  shadowRadius: 40,
  elevation: 18,
};

/** A photo mount picked up off the page — used during the open transition. */
export const shadowLifted: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.26,
  shadowRadius: 34,
  elevation: 16,
};

/** For elements raised above an ink surface, where an umber shadow vanishes. */
export const shadowOnInk: Shadow = {
  shadowColor: SHADOW_COLOR_INK,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 8,
};

/** Convenience record keyed by size. */
export const shadows = {
  small: shadowSmall,
  medium: shadowMedium,
  large: shadowLarge,
  xlarge: shadowXLarge,
  lifted: shadowLifted,
  onInk: shadowOnInk,
  /** No shadow — useful for toggling. */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } satisfies Shadow,
} as const;

/**
 * Returns a platform-aware shadow style.
 *
 * On iOS it returns the full shadow* properties. On Android it returns only
 * `elevation`, plus the shadow colour, which Android *does* honour from API 28
 * and which is what keeps the elevation warm rather than grey.
 */
export function platformShadow(shadow: Shadow): ViewStyle {
  if (Platform.OS === 'android') {
    return {
      elevation: shadow.elevation,
      shadowColor: shadow.shadowColor,
    };
  }

  return {
    shadowColor: shadow.shadowColor,
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius,
  };
}

export type Shadows = typeof shadows;
