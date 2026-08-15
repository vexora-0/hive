import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, radius } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

/** How loud the stamp is. `sm` is the default; `md` is for a badge read alone. */
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /** Text shown inside the badge. Sentence case — never ALL-CAPS. */
  children: string;
  /** Colour variant. */
  variant?: BadgeVariant;
  /** Adds a small filled dot before the label — for live status. */
  dot?: boolean;
  /**
   * Size preset. Defaults to `'sm'` (10pt), which is what dense order rows and
   * photo-tile overlays want. Use `'md'` (12pt) where the badge is the only
   * small thing on the screen and has to be read at arm's length.
   */
  size?: BadgeSize;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variants
//
// A badge is a wash background carrying the hue's own text-grade tone. Every
// pair below was measured against its own fill, not against the page:
//
//   default   #9C5A10  on #FDF0DC — 4.81:1
//   success   #2F7049  on #E8F4EC — 5.26:1
//   warning   #8A5100  on #FDF2E0 — 5.82:1
//   error     #A32E2A  on #FCEAE9 — 6.07:1
//   info      #2E6B77  on #E4F2F4 — 5.25:1
//   neutral   #4F5468  on #F5F0E9 — 6.61:1
//
// These are the `.main` tones rather than the `.dark` ones the badge used to
// reach for. `.main` is text-grade in this palette now — that is the point of
// the rewritten colour file — so the darker step was buying contrast nobody
// needed at the cost of every status reading as urgent.
//
// The dot takes the label's colour rather than a brighter form of the hue.
// A marigold dot on a marigold wash measures 1.9:1 and simply disappears; a
// status mark you cannot see is worse than no mark, because the layout still
// reserves room for it.
// ---------------------------------------------------------------------------

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: {
    bg: colors.primary.amberWash,
    text: colors.text.accent,
  },
  success: {
    bg: colors.success.background,
    text: colors.success.main,
  },
  warning: {
    bg: colors.warning.background,
    text: colors.warning.main,
  },
  error: {
    bg: colors.error.background,
    text: colors.error.main,
  },
  info: {
    bg: colors.info.background,
    text: colors.info.main,
  },
  neutral: {
    bg: colors.gray[100],
    text: colors.text.secondary,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Badge>` — a status mark.
 *
 * Squarer than a pill so it reads as a stamp on paper rather than a tag, and
 * sentence case so it reads as a word rather than a database enum. Status is
 * carried by the label first and the colour second: the wash tells you which
 * family, the word tells you which state.
 *
 * ```tsx
 * <Badge variant="success" dot>Delivered</Badge>
 * ```
 */
export function Badge({
  children,
  variant = 'default',
  dot = false,
  size = 'sm',
  style,
}: BadgeProps) {
  const { bg, text } = VARIANT_COLORS[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: text }]} />}
      <Text variant={size === 'md' ? 'captionBold' : 'tiny'} color={text} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default Badge;
