import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  spring,
  duration,
  timing,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Rendered before the label. Receives the resolved colour. */
  icon?: (color: string) => React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Disables the whole control. */
  disabled?: boolean;
  /** Announced by screen readers as the group's purpose. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const TRACK_PADDING = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SegmentedControl>` — one choice from a small, fixed set.
 *
 * A sunk track with a single raised ink thumb that springs between positions.
 * Compared with a row of independently-bordered buttons, there is exactly one
 * filled shape on screen, so the current choice is legible at a glance and the
 * control reads as one object rather than three.
 *
 * ```tsx
 * <SegmentedControl
 *   options={[{ value: 'parent', label: 'Parent' }, { value: 'teacher', label: 'Teacher' }]}
 *   value={role}
 *   onChange={setRole}
 * />
 * ```
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const [segmentWidth, setSegmentWidth] = useState(0);
  const thumbX = useSharedValue(0);
  const ready = useSharedValue(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
    if (ready.value === 0) {
      // First layout: land in place rather than sliding in from the left.
      thumbX.value = target;
      ready.value = withTiming(1, timing(duration.fast));
    } else {
      thumbX.value = withSpring(target, spring.snappy);
    }
  }, [activeIndex, segmentWidth, thumbX, ready]);

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const inner = event.nativeEvent.layout.width - TRACK_PADDING * 2;
      setSegmentWidth(options.length > 0 ? inner / options.length : 0);
    },
    [options.length],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    width: segmentWidth,
    transform: [{ translateX: thumbX.value }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, disabled && styles.disabled, style]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.thumb, thumbStyle]} />

      {options.map((option) => {
        const selected = option.value === value;
        const tint = selected ? colors.text.onInk : colors.text.secondary;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            {option.icon?.(tint)}
            <Text variant="bodySmallBold" color={tint} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    padding: TRACK_PADDING,
    borderRadius: radius.md,
    backgroundColor: colors.background.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  disabled: {
    opacity: 0.5,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: radius.sm,
    backgroundColor: colors.ink[900],
    ...platformShadow(shadows.small),
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TAP_SIZE - 6,
    paddingHorizontal: spacing.sm,
  },
});

export default SegmentedControl;
