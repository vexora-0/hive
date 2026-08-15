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
  /** Two or three options. See `MAX_SEGMENTS`. */
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

/**
 * **Three segments, never four.**
 *
 * A segmented control divides one fixed width between its options, so each new
 * segment takes room from every other one: at four the labels start truncating
 * on a small phone, and truncated labels are the reason segmented controls get
 * replaced by icons, which is how a control stops being readable altogether.
 *
 * Past three, the choice is a different idiom — a scrolling row of `Chip`s for
 * a filter, a tab bar for navigation, a `BottomSheet` list for anything longer.
 *
 * This is enforced with a development warning rather than a type or a silent
 * truncation: dropping an option would hide a choice the user needs, and the
 * fix belongs in the screen that decided to have four of them.
 */
export const MAX_SEGMENTS = 3;

/**
 * The segment is 38 tall so the whole control clears 46 with its track padding;
 * 3px of hitSlop top and bottom takes the *touch* target to 44.
 */
const SEGMENT_HEIGHT = MIN_TAP_SIZE - 6;
const SEGMENT_HIT_SLOP = { top: 3, bottom: 3 } as const;

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
 * The thumb moves on **x only**, at ζ = 0.91 over ~220ms. It used to run at
 * ζ = 0.69, where one segment-width of travel overshot far enough to read as
 * the thumb missing its mark and coming back; animating width at the same time
 * is what clipped the first and last labels. Both are fixed by moving less.
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
    if (__DEV__ && options.length > MAX_SEGMENTS) {
      console.warn(
        `[SegmentedControl] ${options.length} segments — the cap is ${MAX_SEGMENTS}. ` +
          'Labels truncate past three. Use a scrolling row of <Chip>s for a ' +
          'filter, or a sheet for a longer list.',
      );
    }
  }, [options.length]);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
    if (ready.value === 0) {
      // First layout: land in place rather than sliding in from the left. The
      // fade-in is a timing, not a spring — a spring on opacity clamps at 1.0.
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

  // `width` is set from layout state rather than animated: the thumb changes
  // size only when the control itself is re-measured, and never while moving.
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
        // Icons differ by fill and weight, never by hue: both states take the
        // same ink as the word beside them.
        const tint = selected ? colors.text.onInk : colors.text.secondary;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            hitSlop={SEGMENT_HIT_SLOP}
            onPress={() => {
              if (selected) return;
              // At finger-lift, with the thumb: the tap and the tick land
              // together rather than the phone answering before the screen has.
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
    minHeight: SEGMENT_HEIGHT,
    paddingHorizontal: spacing.sm,
  },
});

export default SegmentedControl;
