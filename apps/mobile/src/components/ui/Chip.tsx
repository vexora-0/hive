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
// ---------------------------------------------------------------------------

export interface ChipProps {
  /** Chip label. */
  children: string;
  /** Whether the chip is currently selected. */
  selected?: boolean;
  /** Called on press. Omit for a static, non-interactive chip. */
  onPress?: () => void;
  /** Icon rendered before the label. */
  icon?: React.ReactNode;
  /** Colour used when selected. Defaults to marigold. */
  accent?: string;
  /** Disables interaction. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Chip>` — a selectable filter or tag.
 *
 * Selection is carried by a filled ink pill, not by a coloured border, so a
 * row of chips has exactly one dark shape in it and the choice is readable
 * from across the room. Used for class filters, product options and student
 * tags.
 *
 * ```tsx
 * <Chip selected={classId === c.id} onPress={() => select(c.id)}>
 *   {c.name}
 * </Chip>
 * ```
 */
export function Chip({
  children,
  selected = false,
  onPress,
  icon,
  accent = colors.primary.amber,
  disabled = false,
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

  const content = (
    <>
      {selected && <View style={[styles.mark, { backgroundColor: accent }]} />}
      {icon}
      <Text variant="bodySmallBold" color={labelColor} numberOfLines={1}>
        {children}
      </Text>
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
      accessibilityRole="button"
      accessibilityLabel={children}
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
    minHeight: MIN_TAP_SIZE - 8,
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
});

export default Chip;
