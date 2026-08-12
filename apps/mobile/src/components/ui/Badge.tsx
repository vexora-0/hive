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

export interface BadgeProps {
  /** Text shown inside the badge. */
  children: string;
  /** Colour variant. */
  variant?: BadgeVariant;
  /** Adds a small filled dot before the label — for live status. */
  dot?: boolean;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * A badge is a wash background with the *dark* form of its hue as the label,
 * which is the only combination in this palette that clears 4.5:1 at 12px.
 */
const VARIANT_COLORS: Record<
  BadgeVariant,
  { bg: string; text: string; dot: string }
> = {
  default: {
    bg: colors.primary.amberWash,
    text: colors.text.accent,
    dot: colors.primary.amber,
  },
  success: {
    bg: colors.success.background,
    text: colors.success.dark,
    dot: colors.success.main,
  },
  warning: {
    bg: colors.warning.background,
    text: colors.warning.dark,
    dot: colors.warning.main,
  },
  error: {
    bg: colors.error.background,
    text: colors.error.dark,
    dot: colors.error.main,
  },
  info: {
    bg: colors.info.background,
    text: colors.info.dark,
    dot: colors.info.main,
  },
  neutral: {
    bg: colors.gray[100],
    text: colors.text.secondary,
    dot: colors.gray[500],
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Badge>` — a status mark.
 *
 * Squarer than a pill so it reads as a stamp on paper rather than a tag.
 *
 * ```tsx
 * <Badge variant="success" dot>Delivered</Badge>
 * ```
 */
export function Badge({
  children,
  variant = 'default',
  dot = false,
  style,
}: BadgeProps) {
  const { bg, text, dot: dotColor } = VARIANT_COLORS[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text variant="tiny" color={text} numberOfLines={1}>
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
