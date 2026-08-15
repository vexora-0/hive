import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, spring, pressScale, MIN_TAP_SIZE } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
//
// `children` is a required string, so an icon-only chip cannot be built from
// this component — which is deliberate. An icon-only filter strip asks the user
// to decode a glyph before they can choose; a labelled pill says what it does.
// Icons are allowed *beside* the word, never instead of it.
// ---------------------------------------------------------------------------

export interface ChipProps {
  /** Chip label. Always present — there is no icon-only form. */
  children: string;
  /** Whether the chip is currently selected. */
  selected?: boolean;
  /** Called on press. Omit for a static, non-interactive chip. */
  onPress?: () => void;
  /** Icon rendered before the label. */
  icon?: React.ReactNode;
  /** Colour used when selected. Defaults to marigold. */
  accent?: string;
  /**
   * A running total shown after the label — "Aarav 7".
   *
   * Built for the teacher's tagging rail, where the question is never "is this
   * child selected" but "how many photos has this child got so far". Coverage
   * becomes visible along the rail instead of requiring an audit at the end.
   *
   * Rendered only when greater than zero: a row of chips reading "0" is noise,
   * and zero is already said by the chip not being marked.
   */
  count?: number;
  /** Disables interaction. */
  disabled?: boolean;
  /** Overrides the announced label. Defaults to the label plus its count. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The visual height is 36 so a rail of chips stays dense enough to scan, and
 * 4px of hitSlop top and bottom takes the *touch* target to exactly 44.
 */
const CHIP_HEIGHT = MIN_TAP_SIZE - 8;
const CHIP_HIT_SLOP = { top: 4, bottom: 4 } as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Chip>` — a selectable filter or tag.
 *
 * Selection is carried by a filled ink pill, not by a coloured border, so a row
 * of chips has exactly one dark shape in it and the choice is readable from
 * across the room. Used for class filters, product options and student tags.
 *
 * **One accent per chip.** A selected chip shows either the marigold dot or the
 * count, never both — two markers on one pill and neither means anything. The
 * counter is marigold under an ink numeral (8.08:1) when the chip is selected,
 * and a marigold wash under the readable marigold (4.81:1) when it is not.
 *
 * As a filter strip, keep to three or four chips; as the teacher's tagging rail
 * there is one chip per child and the rail scrolls. Which of the two you are
 * building is a screen-level judgement, so this component does not cap it.
 *
 * ```tsx
 * <Chip selected={classId === c.id} onPress={() => select(c.id)}>
 *   {c.name}
 * </Chip>
 *
 * <Chip selected={tagged > 0} count={tagged} onPress={() => tag(child.id)}>
 *   {child.firstName}
 * </Chip>
 * ```
 */
export function Chip({
  children,
  selected = false,
  onPress,
  icon,
  accent = colors.primary.amber,
  count,
  disabled = false,
  accessibilityLabel,
  style,
}: ChipProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.button, spring.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();
    onPress?.();
  }, [disabled, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const chipStyle: ViewStyle = {
    backgroundColor: selected ? colors.ink[900] : colors.background.surface,
    borderColor: selected ? colors.ink[900] : colors.border.light,
    opacity: disabled ? 0.45 : 1,
  };

  const labelColor = selected ? colors.text.onInk : colors.text.secondary;

  const hasCount = typeof count === 'number' && count > 0;
  const countBg = selected ? accent : colors.primary.amberWash;
  const countColor = selected ? colors.ink[900] : colors.text.accent;

  const content = (
    <>
      {selected && !hasCount && (
        <View style={[styles.mark, { backgroundColor: accent }]} />
      )}
      {icon}
      <Text variant="bodySmallBold" color={labelColor} numberOfLines={1}>
        {children}
      </Text>
      {hasCount && (
        <View style={[styles.count, { backgroundColor: countBg }]}>
          <Text
            variant="captionBold"
            color={countColor}
            // Tabular figures so the pill does not twitch as a count climbs
            // from 9 to 10 while the teacher is still tapping.
            style={styles.countLabel}
          >
            {count}
          </Text>
        </View>
      )}
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, chipStyle, style]}>{content}</View>;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (hasCount ? `${children}, ${count}` : children)
      }
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, chipStyle, animatedStyle, style]}
    >
      {content}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  /** The accent dot that marks a selected chip without recolouring it. */
  mark: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  /** The running total. Same minimum width at one digit or two, so a rail of
   *  chips keeps its rhythm as counts climb. */
  count: {
    minWidth: 22,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Pulls the counter back into the pill's optical right edge.
    marginRight: -spacing.xs,
  },
  countLabel: {
    fontVariant: ['tabular-nums'],
  },
});

export default Chip;
