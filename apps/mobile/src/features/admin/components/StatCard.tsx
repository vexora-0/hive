import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatCardProps {
  /** Ionicons icon name displayed at the top-left of the card. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Human-readable label shown below the value. */
  label: string;
  /** Numeric value to animate to. */
  value: number;
  /** Background tint colour for the card. */
  color: string;
  /** String prepended to the displayed number (e.g. "$"). */
  prefix?: string;
  /** String appended to the displayed number (e.g. "%"). */
  suffix?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StatCard>` -- a coloured card displaying a single dashboard statistic
 * with an animated counter, an icon, and a label.
 *
 * ```tsx
 * <StatCard
 *   icon="school-outline"
 *   label="Schools"
 *   value={42}
 *   color={colors.primary.amber}
 * />
 * ```
 */
export function StatCard({
  icon,
  label,
  value,
  color,
  prefix,
  suffix,
}: StatCardProps) {
  return (
    <Card style={[styles.card, { backgroundColor: color + '1A' }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '33' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <AnimatedCounter
        value={value}
        prefix={prefix}
        suffix={suffix}
        style={[styles.value, { color: colors.text.primary }]}
      />
      <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: layout.cardRadius,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
});

export default StatCard;
