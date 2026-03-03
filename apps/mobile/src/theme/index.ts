/**
 * Hive Theme — unified re-export
 *
 * Usage:
 * ```ts
 * import { theme } from '@/theme';
 *
 * theme.colors.primary.amber;
 * theme.spacing.md;
 * theme.textStyles.h1;
 * theme.shadows.medium;
 * theme.constants.FEED_PAGE_SIZE;
 * ```
 */

export { colors } from './colors';
export type { Colors } from './colors';

export { spacing, grid, layout } from './spacing';
export type { Spacing, Layout } from './spacing';

export {
  fontFamily,
  fontSize,
  lineHeight,
  textStyles,
  getTextStyle,
} from './typography';
export type { TypographyVariant, TextStyle, Typography } from './typography';

export {
  shadows,
  shadowSmall,
  shadowMedium,
  shadowLarge,
  platformShadow,
} from './shadows';
export type { Shadow, Shadows } from './shadows';

export {
  MIN_TAP_SIZE,
  OTP_LENGTH,
  FEED_PAGE_SIZE,
  MAX_UPLOAD_IMAGES,
  MAX_FILE_SIZE_MB,
  RESEND_COOLDOWN_SEC,
  MAX_OTP_ATTEMPTS,
  LOCKOUT_DURATION_SEC,
  STALE_TIME_MS,
  GC_TIME_MS,
  ANIMATION_DURATION,
} from './constants';

// ── Unified theme object ─────────────────────────────────────────────

import { colors } from './colors';
import { spacing, grid, layout } from './spacing';
import { textStyles, getTextStyle, fontFamily, fontSize, lineHeight } from './typography';
import { shadows, platformShadow } from './shadows';
import * as constants from './constants';

export const theme = {
  colors,
  spacing,
  grid,
  layout,
  fontFamily,
  fontSize,
  lineHeight,
  textStyles,
  getTextStyle,
  shadows,
  platformShadow,
  constants,
} as const;

export type Theme = typeof theme;
