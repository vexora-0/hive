import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { formatRupees } from '@/features/orders/constants/products';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatCardProps {
  /** Ionicons icon name shown in the tile at the top of the card. */
  icon: keyof typeof Ionicons.glyphMap;
  /** What the number counts. */
  label: string;
  /** Numeric value to animate to. For `format="rupees"` this is integer paise. */
  value: number;
  /** The statistic's accent — used for the icon tile only. */
  color: string;
  /** Wash behind the icon, from the same hue family as `color`. */
  wash: string;
  /** How to render the number. */
  format?: 'plain' | 'rupees';
  /** String appended to the displayed number (e.g. "%"). */
  suffix?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StatCard>` — one number on the admin dashboard.
 *
 * White paper with a single tinted tile, rather than a card washed in its
 * statistic's colour. Six differently-tinted cards read as a status board
 * where every tile is warning about something; the colour belongs to the icon,
 * and the number belongs to the page.
 *
 * ```tsx
 * <StatCard icon="cash-outline" label="Revenue" value={499000} format="rupees" … />
 * ```
 */
export function StatCard({
  icon,
  label,
  value,
  color,
  wash,
  format = 'plain',
  suffix,
}: StatCardProps) {
  return (
    <Card elevation="low" style={styles.card}>
      <View style={[styles.iconTile, { backgroundColor: wash }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      {/* The tile is labelled as one thing, because the counter itself is
          hidden from assistive tech — see the note in AnimatedCounter. */}
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label}: ${format === 'rupees' ? formatRupees(value) : value}${suffix ?? ''}`}
      >
        <AnimatedCounter value={value} format={format} suffix={suffix} style={styles.value} />
        <Text
          variant="caption"
          color={colors.text.tertiary}
          numberOfLines={1}
          importantForAccessibility="no"
        >
          {label}
        </Text>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    minHeight: 124,
    justifyContent: 'space-between',
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    marginBottom: 2,
  },
});

export default StatCard;
