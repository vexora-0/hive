import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, MIN_TAP_SIZE } from '@/theme';
import { Text, type TextVariant } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How loud the title is.
 *
 *  - `lg` (h2, 25pt) — the one thing a screen is about, where the screen has no
 *    navigation title of its own.
 *  - `md` (h3, 22pt) — **the default**, and the right answer nearly always: a
 *    named region inside a screen.
 *  - `sm` (h4, 17pt) — a sub-region inside a card or a sheet, where an h3 would
 *    outrank the screen's own title.
 */
export type SectionHeaderSize = 'sm' | 'md' | 'lg';

const TITLE_VARIANT: Record<SectionHeaderSize, TextVariant> = {
  sm: 'h4',
  md: 'h3',
  lg: 'h2',
};

export interface SectionHeaderProps {
  /** The section's name. Sentence case, with a full stop only if it is a sentence. */
  title: string;
  /**
   * A small uppercase mark above the title. Use it only when it says something
   * the title cannot — a date, a count, a state — never to restate the title.
   */
  eyebrow?: string;
  /** A quiet line under the title. */
  subtitle?: string;
  /** Optional trailing action, e.g. "See all". */
  action?: {
    label: string;
    onPress: () => void;
    /** Rendered after the label. Receives the resolved colour. */
    icon?: (color: string) => React.ReactNode;
    /** Announced after the label — where it leads, when it is not obvious. */
    accessibilityHint?: string;
  };
  /** Title weight. Defaults to `'md'` (h3). */
  size?: SectionHeaderSize;
  /** Renders for a dark panel — ink card, hero, tab-bar-coloured surface. */
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SectionHeader>` — names a region of a screen.
 *
 * This is the one way to title a region, and it exists so that two screens
 * naming a region agree on the type ramp, the gap under the eyebrow and the
 * position of the trailing action. A screen that hand-rolls
 * `<Text variant="h3">` plus a `<Pressable>` gets all three slightly wrong, and
 * the difference is only visible once the two screens sit side by side in a
 * tab bar.
 *
 * The eyebrow is the system's one structural device, and it earns its place by
 * carrying information rather than decoration: "3 waiting", "Tuesday", "This
 * term". If the eyebrow would only repeat the title, leave it off.
 *
 * Colours are measured for both grounds — on paper the title is ink at 16.40:1,
 * the eyebrow `text.tertiary` at 4.64:1 (the floor, and the reason nothing
 * lighter is offered) and the action `text.accent` at 5.12:1. On ink they
 * become 14.09:1, 7.63:1 and 14.09:1 respectively. There is no marigold here:
 * an accent that has to be read is `text.accent`, never `primary.amber`.
 *
 * ```tsx
 * <SectionHeader
 *   eyebrow="This week"
 *   title="Moments"
 *   subtitle="Tuesday, 12 Aug · 9 photos · Ms. Priya"
 *   action={{ label: 'See all', onPress: openAll }}
 * />
 * ```
 */
export function SectionHeader({
  title,
  eyebrow,
  subtitle,
  action,
  size = 'md',
  onInk = false,
  style,
}: SectionHeaderProps) {
  const eyebrowColor = onInk ? colors.text.onInkMuted : colors.text.tertiary;
  const actionColor = onInk ? colors.text.onInk : colors.text.accent;

  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {eyebrow && (
          <Text variant="eyebrow" color={eyebrowColor} style={styles.eyebrow}>
            {eyebrow}
          </Text>
        )}

        <Text variant={TITLE_VARIANT[size]} onInk={onInk}>
          {title}
        </Text>

        {subtitle && (
          <Text variant="bodySmall" onInk={onInk} muted style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.accessibilityHint}
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="bodySmallBold" color={actionColor}>
            {action.label}
          </Text>
          {action.icon?.(actionColor)}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // The label is short, so the row is what makes the target tappable.
    minHeight: MIN_TAP_SIZE,
    justifyContent: 'center',
  },
});

export default SectionHeader;
