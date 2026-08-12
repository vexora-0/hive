import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, MIN_TAP_SIZE } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionHeaderProps {
  /** The section's name. */
  title: string;
  /**
   * A small uppercase mark above the title. Use it only when it says something
   * the title cannot — a date, a count, a state — never to restate the title.
   */
  eyebrow?: string;
  /** A quiet line under the title. */
  subtitle?: string;
  /** Optional trailing action, e.g. "See all". */
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SectionHeader>` — names a region of a screen.
 *
 * The eyebrow is the system's one structural device, and it earns its place by
 * carrying information rather than decoration: "3 waiting", "Tuesday", "This
 * term". If the eyebrow would only repeat the title, leave it off.
 *
 * ```tsx
 * <SectionHeader
 *   eyebrow="This week"
 *   title="Moments"
 *   action={{ label: 'See all', onPress: openAll }}
 * />
 * ```
 */
export function SectionHeader({
  title,
  eyebrow,
  subtitle,
  action,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {eyebrow && (
          <Text variant="eyebrow" color={colors.text.tertiary} style={styles.eyebrow}>
            {eyebrow}
          </Text>
        )}
        <Text variant="h3">{title}</Text>
        {subtitle && (
          <Text variant="bodySmall" muted style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="bodySmallBold" color={colors.text.accent}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  action: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: 'center',
  },
});

export default SectionHeader;
