import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AnimatedCounterProps {
  /** Target numeric value to count up to. */
  value: number;
  /** Duration of the count-up animation in ms. @default 1200 */
  duration?: number;
  /** String prepended to the displayed number (e.g. "$"). */
  prefix?: string;
  /** String appended to the displayed number (e.g. "%"). */
  suffix?: string;
  /** Number of decimal places to display. @default 0 */
  decimalPlaces?: number;
  /** Optional text style overrides. */
  style?: StyleProp<TextStyle>;
}

// --------------------------------------------------------------------------
// Setup: Animated TextInput used as a read-only display
// --------------------------------------------------------------------------

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * Smoothly animates a number from 0 (or its previous value) to the given
 * `value` using react-native-reanimated.
 *
 * Because Reanimated animated props run on the UI thread, we drive a
 * `TextInput` with `editable={false}` for flicker-free updates.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1200,
  prefix = '',
  suffix = '',
  decimalPlaces = 0,
  style,
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  const animatedProps = useAnimatedProps(() => {
    const displayed = animatedValue.value.toFixed(decimalPlaces);
    return {
      text: `${prefix}${displayed}${suffix}`,
      // defaultValue is needed for Android to update the native input
      defaultValue: `${prefix}${displayed}${suffix}`,
    } as Record<string, string>;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      // @ts-expect-error — animatedProps typing with TextInput is imprecise
      animatedProps={animatedProps}
      style={[styles.text, style]}
    />
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  text: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    padding: 0,
    // Reset default TextInput styling
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});

export default AnimatedCounter;
