import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  colors,
  spacing,
  duration as motionDuration,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { formatRupees } from '@/features/orders/constants/products';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatRowProps {
  /** Ionicons **outline** name. One family, one weight, one ink — see below. */
  icon: keyof typeof Ionicons.glyphMap;
  /** What the number counts. Sentence case, never shouted. */
  label: string;
  /** Numeric value to count to. For `format="rupees"` this is integer paise. */
  value: number;
  /** How to render the number. @default 'plain' */
  format?: 'plain' | 'rupees';
  /** A quiet line under the label — where the number came from, or what it excludes. */
  caption?: string;
  /**
   * Where the number goes. A row with a destination gets a chevron; one
   * without is simply read. **Only pass this when the tap lands somewhere the
   * admin can act** — a chevron that opens a screen with nothing to do on it is
   * worse than no chevron.
   */
  onPress?: () => void;
  /** Announced after the label — what tapping does, when it is not obvious. */
  accessibilityHint?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StatRow>` — one number on the admin dashboard.
 *
 * This replaces a 2-column grid of six tiles, each with its own hue: schools
 * amber, people peacock, photos leaf, orders plum, revenue green, active-today
 * rose. Six hues encoding nothing but "this is the third card" is the single
 * most dating device in the category — Brightwheel ships a twelve-colour tile
 * grid, Procare thirteen multicolour stickers — and it is rubric item 14. The
 * icon here is drawn in **one ink** at one weight for every row, so what
 * separates the rows is what they say rather than what colour they are.
 *
 * The second change is that a row can lead somewhere. An admin looking at
 * "Orders 34" wants the queue, not the number; a stat a person can act on beats
 * six they cannot. Rows without a destination — money taken, photographs
 * shared — stay quiet and lose the chevron, so the affordance keeps meaning.
 *
 * ```tsx
 * <StatRow icon="receipt-outline" label="Orders" value={34} onPress={openQueue} />
 * <StatRow icon="cash-outline" label="Taken in prints" value={499000} format="rupees" />
 * ```
 */
export function StatRow({
  icon,
  label,
  value,
  format = 'plain',
  caption,
  onPress,
  accessibilityHint,
}: StatRowProps) {
  const spoken = format === 'rupees' ? formatRupees(value) : String(value);

  const body = (
    <>
      <Ionicons name={icon} size={19} color={colors.text.secondary} />

      <View style={styles.text}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        {caption && (
          <Text variant="caption" muted numberOfLines={1} style={styles.caption}>
            {caption}
          </Text>
        )}
      </View>

      {/* The counter paints into a TextInput, which a screen reader announces
          as an editable field, so it hides itself and the row carries the
          label instead. */}
      <AnimatedCounter
        value={value}
        format={format}
        duration={motionDuration.slow}
        style={styles.value}
      />

      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={17}
          color={colors.text.tertiary}
        />
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label}: ${spoken}`}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${spoken}`}
      accessibilityHint={accessibilityHint}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TAP_SIZE + spacing.ms,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  text: {
    flex: 1,
  },
  caption: {
    marginTop: spacing.xxs,
  },
  value: {
    fontSize: 22,
    letterSpacing: -0.9,
  },
});

export default StatRow;
