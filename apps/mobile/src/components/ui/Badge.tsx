import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

export interface BadgeProps {
  /** Text shown inside the badge pill. */
  children: string;
  /** Color variant. */
  variant?: BadgeVariant;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variant color map
// ---------------------------------------------------------------------------

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: {
    bg: colors.primary.amber + '1F', // ~12 % opacity amber
    text: colors.primary.amberDark,
  },
  success: {
    bg: colors.success.background,
    text: colors.success.dark,
  },
  warning: {
    bg: colors.warning.background,
    text: colors.warning.dark,
  },
  error: {
    bg: colors.error.background,
    text: colors.error.dark,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Badge>` — small colored pill label.
 *
 * ```tsx
 * <Badge variant="success">Approved</Badge>
 * <Badge variant="error">Overdue</Badge>
 * ```
 */
export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const { bg, text } = VARIANT_COLORS[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text variant="captionBold" color={text}>
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
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 9999,
  },
});

export default Badge;
