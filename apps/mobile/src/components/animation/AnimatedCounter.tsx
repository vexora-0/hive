import React, { useEffect, useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TextInput } from 'react-native';

import { colors, fontFamily } from '@/theme';

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
  /**
   * `'rupees'` treats `value` as integer paise and renders it as whole rupees
   * with Indian digit grouping — ₹1,29,900, not ₹129900 and not $129900.
   * @default 'plain'
   */
  format?: 'plain' | 'rupees';
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
  format = 'plain',
  style,
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  /**
   * How wide the finished number will be, in characters.
   *
   * The figure is painted into a `TextInput`, because Reanimated can only
   * drive `text` from the UI thread. On react-native-web that is a real
   * `<input>`, and an input with no width claims the browser's default
   * intrinsic size — about twenty characters. A single digit at 40px measured
   * **459pt of claimed width against a 310pt row**, which is why the label
   * beside it had nowhere to go: the admin roster rendered "Photographs
   * shared" as "P.".
   *
   * It cannot be left to `width: auto` either, since the element is empty on
   * the JS side — the text only ever arrives through an animated prop the DOM
   * never sees as a value. So the width is derived from the *destination*
   * value, which is known here, and held steady while the count runs so the
   * layout does not jitter as digits appear. `ch` is the browser's own
   * character unit; native ignores the whole thing, having never had the
   * phantom width in the first place.
   */
  const widthCh = useMemo(() => {
    const settled =
      format === 'rupees'
        ? `₹${Math.floor(Math.abs(value) / 100).toLocaleString('en-IN')}`
        : `${prefix}${Math.abs(value).toFixed(decimalPlaces)}${suffix}`;
    // A digit in a proportional face is wider than the `ch` unit's reference
    // "0" in some cuts, so a little slack keeps the last glyph off the edge.
    return settled.length + 0.5;
  }, [value, format, prefix, suffix, decimalPlaces]);

  const animatedProps = useAnimatedProps(() => {
    let displayed: string;

    if (format === 'rupees') {
      // Grouping is built by hand rather than with a regex or Intl: this runs
      // on the UI thread as a worklet, and plain arithmetic and string
      // concatenation are the parts of JS guaranteed to work there.
      const rupees = Math.floor(Math.abs(Math.round(animatedValue.value)) / 100);
      const digits = String(rupees);

      let grouped = digits;
      if (digits.length > 3) {
        const last3 = digits.slice(-3);
        const rest = digits.slice(0, -3);
        let head = '';
        let placed = 0;
        for (let i = rest.length - 1; i >= 0; i--) {
          if (placed > 0 && placed % 2 === 0) head = `,${head}`;
          head = rest[i] + head;
          placed++;
        }
        grouped = `${head},${last3}`;
      }

      displayed = `₹${grouped}`;
    } else {
      displayed = `${prefix}${animatedValue.value.toFixed(decimalPlaces)}${suffix}`;
    }

    return {
      text: displayed,
      // defaultValue is needed for Android to update the native input
      defaultValue: displayed,
    } as Record<string, string>;
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      // The number is painted into a TextInput because Reanimated can only
      // drive its `text` prop from the UI thread. To a screen reader that is a
      // focusable, editable field announced as "0", so it is hidden here and
      // the caller labels the whole tile instead.
      accessible={false}
      focusable={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      animatedProps={animatedProps}
      style={[
        styles.text,
        // Web only: see the note on `widthCh`. `width` in `ch` is meaningless
        // to the native text input, which sizes itself to its content.
        Platform.OS === 'web' ? ({ width: `${widthCh}ch` } as object) : null,
        style,
      ]}
    />
  );
};

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.text.primary,
    padding: 0,
    // Reset default TextInput styling
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
});

export default AnimatedCounter;
