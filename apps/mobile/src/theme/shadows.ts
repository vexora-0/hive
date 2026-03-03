/**
 * Hive Shadow Presets
 *
 * Each preset contains:
 *  - iOS shadow properties (shadowColor, shadowOffset, shadowOpacity, shadowRadius)
 *  - Android elevation
 *
 * The warm-tinted shadowColor keeps shadows consistent with Hive's cream palette.
 */

import { Platform, ViewStyle } from 'react-native';

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const SHADOW_COLOR = '#1A1A2E';

/**
 * Small shadow — cards, input fields, thumbnails.
 * iOS: 2px y-offset, 4px blur
 * Android: elevation 2
 */
export const shadowSmall: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 2,
};

/**
 * Medium shadow — floating action buttons, popovers, modals.
 * iOS: 4px y-offset, 8px blur
 * Android: elevation 4
 */
export const shadowMedium: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 4,
};

/**
 * Large shadow — bottom sheets, drawers, dialogs.
 * iOS: 8px y-offset, 16px blur
 * Android: elevation 8
 */
export const shadowLarge: Shadow = {
  shadowColor: SHADOW_COLOR,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.16,
  shadowRadius: 16,
  elevation: 8,
};

/** Convenience record keyed by size. */
export const shadows = {
  small: shadowSmall,
  medium: shadowMedium,
  large: shadowLarge,
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
 * On iOS it returns the full shadow* properties.
 * On Android it returns only `elevation` (Android ignores iOS shadow props).
 */
export function platformShadow(shadow: Shadow): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: shadow.elevation };
  }

  return {
    shadowColor: shadow.shadowColor,
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius,
  };
}

export type Shadows = typeof shadows;
