/**
 * Hive Theme — unified re-export
 *
 * Usage:
 * ```ts
 * import { colors, spacing, radius, spring } from '@/theme';
 *
 * colors.primary.amber;   // marigold — the acting accent
 * radius.lg;              // 22 — cards
 * spring.press;           // press physics
 * ```
 */

export {
  colors,
  roleAccent,
  identityColor,
  identityPalette,
  withAlpha,
} from './colors';
export type { Colors, IdentityPalette } from './colors';

export {
  play,
  PLAY_HUES,
  playHue,
  isDecorativeColor,
  hexPoints,
  combPitch,
  PLAY_STROKE,
  PLAY_STROKE_FINE,
  PLAY_VIEW_BOX,
  PLAY_LINE,
} from './play';
export type { PlayHue } from './play';

export { spacing, radius, grid, layout } from './spacing';
export type { Spacing, Radius, Layout } from './spacing';

export {
  fontFamily,
  fontSize,
  lineHeight,
  tracking,
  textStyles,
  getTextStyle,
} from './typography';
export type { TypographyVariant, TextStyle, Typography } from './typography';

export {
  shadows,
  shadowSmall,
  shadowMedium,
  shadowLarge,
  shadowXLarge,
  shadowLifted,
  shadowOnInk,
  platformShadow,
} from './shadows';
export type { Shadow, Shadows } from './shadows';

export {
  motion,
  spring,
  duration,
  easing,
  timing,
  exitTiming,
  stagger,
  pressScale,
  travel,
  ambient,
  phase,
  useReducedMotion,
  STAGGER_STEP,
} from './motion';
export type { Motion } from './motion';

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

import {
  colors,
  roleAccent,
  identityColor,
  identityPalette,
  withAlpha,
} from './colors';
import { play, playHue } from './play';
import { spacing, radius, grid, layout } from './spacing';
import {
  textStyles,
  getTextStyle,
  fontFamily,
  fontSize,
  lineHeight,
  tracking,
} from './typography';
import { shadows, platformShadow } from './shadows';
import { motion } from './motion';
import * as constants from './constants';

export const theme = {
  colors,
  play,
  playHue,
  roleAccent,
  identityColor,
  identityPalette,
  withAlpha,
  spacing,
  radius,
  grid,
  layout,
  fontFamily,
  fontSize,
  lineHeight,
  tracking,
  textStyles,
  getTextStyle,
  shadows,
  platformShadow,
  motion,
  constants,
} as const;

export type Theme = typeof theme;
