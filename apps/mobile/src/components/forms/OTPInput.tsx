import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  Pressable,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  lineHeight,
  spring,
  timing,
  duration,
  OTP_LENGTH,
} from '@/theme';
import { ShakeAnimation, type ShakeAnimationHandle } from '@/components/animation';
import { Text } from '@/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OTPInputHandle {
  /** Trigger the shake animation (e.g. on server-side error). */
  shake: () => void;
  /** Focus the first input box. */
  focus: () => void;
  /** Clear all boxes and focus the first. */
  clear: () => void;
}

export interface OTPInputProps {
  /** Number of OTP digits. @default OTP_LENGTH (6) */
  length?: number;
  /** Called when all digits have been entered. */
  onComplete?: (code: string) => void;
  /** When true, shows error styling and triggers a shake. */
  error?: boolean;
  /** Disables all input boxes. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Animated box sub-component
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface OTPBoxProps {
  value: string;
  focused: boolean;
  error: boolean;
  disabled: boolean;
  onPress: () => void;
}

/**
 * One digit box.
 *
 * Three states, and only one of them is marigold:
 *
 *  - **at rest** — a sunk paper well with a hairline, the same recessed idiom
 *    as `<TextInput>`, so an untouched code reads as six quiet slots rather
 *    than six empty boxes shouting for attention.
 *  - **filled** — raised to white with a slightly firmer edge. The digit itself
 *    is the signal that a box is done; the chrome does not need to repeat it.
 *  - **focused** — a marigold border over a marigold wash. **Marigold is a
 *    surface here, never the digit.** At 2.03:1 on paper it cannot carry text,
 *    so the digit stays ink and the colour marks only *where you are*. It used
 *    to fire on fill as well as focus, which put all six boxes in the one
 *    accent at once and left nothing marking the caret.
 *
 * Colour transitions are timings; only the confirming pop is a spring. A spring
 * driving `interpolateColor` clamps at 1.0 and stalls visibly at the end of its
 * run — springs move things, timings colour them.
 */
function OTPBox({ value, focused, error, disabled, onPress }: OTPBoxProps) {
  const focusAnim = useSharedValue(0);
  const fillAnim = useSharedValue(value ? 1 : 0);
  const errorAnim = useSharedValue(error ? 1 : 0);
  const popAnim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    focusAnim.value = withTiming(focused ? 1 : 0, timing(duration.fast));
  }, [focused, focusAnim]);

  useEffect(() => {
    errorAnim.value = withTiming(error ? 1 : 0, timing(duration.fast));
  }, [error, errorAnim]);

  // A filled box pops once, so entering a digit is confirmed by the box and
  // not only by the caret moving on. Transform only — 4% of a 44pt box is a
  // press-sized move, which is the one place a little overshoot belongs.
  useEffect(() => {
    fillAnim.value = withTiming(value ? 1 : 0, timing(duration.fast));
    popAnim.value = withSpring(value ? 1 : 0, spring.bouncy);
  }, [value, fillAnim, popAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const fill = fillAnim.value;
    const focus = focusAnim.value;
    const err = errorAnim.value;

    return {
      borderColor: interpolateColor(
        err,
        [0, 1],
        [
          interpolateColor(
            focus,
            [0, 1],
            [
              interpolateColor(
                fill,
                [0, 1],
                [colors.border.light, colors.border.default],
              ),
              colors.primary.amber,
            ],
          ),
          colors.error.main,
        ],
      ),
      backgroundColor: interpolateColor(
        err,
        [0, 1],
        [
          interpolateColor(
            focus,
            [0, 1],
            [
              interpolateColor(
                fill,
                [0, 1],
                [colors.background.surfaceSecondary, colors.background.surface],
              ),
              colors.primary.amberWash,
            ],
          ),
          colors.error.background,
        ],
      ),
      transform: [{ scale: 1 + popAnim.value * 0.04 }],
    };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.box, animatedStyle, disabled && styles.boxDisabled]}
      // The box is scenery. The real control is the field stacked over it,
      // which carries the "Digit n" label, so hiding this one keeps a screen
      // reader from announcing every slot twice.
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        variant="price"
        color={disabled ? colors.text.tertiary : colors.text.primary}
        style={styles.boxText}
      >
        {value}
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * `<OTPInput>` -- row of individual digit boxes for one-time password entry.
 *
 * Features:
 * - Auto-advances focus on digit entry.
 * - Backspace clears the current box and moves to the previous one.
 * - Calls `onComplete` when the last digit is entered.
 * - Wraps content in `<ShakeAnimation>` that can be triggered via ref or
 *   the `error` prop.
 *
 * ```tsx
 * const otpRef = useRef<OTPInputHandle>(null);
 *
 * <OTPInput
 *   ref={otpRef}
 *   onComplete={(code) => verifyOtp(code)}
 *   error={hasError}
 * />
 * ```
 */
export const OTPInput = forwardRef<OTPInputHandle, OTPInputProps>(
  function OTPInput(
    { length = OTP_LENGTH, onComplete, error = false, disabled = false },
    ref,
  ) {
    // ── State ──────────────────────────────────────────────────────────
    const [digits, setDigits] = useState<string[]>(() =>
      Array.from({ length }, () => ''),
    );
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);

    const inputRefs = useRef<(RNTextInput | null)[]>([]);
    const shakeRef = useRef<ShakeAnimationHandle>(null);

    // ── Shake on error prop change ─────────────────────────────────────
    const prevErrorRef = useRef(false);
    useEffect(() => {
      if (error && !prevErrorRef.current) {
        shakeRef.current?.shake();
      }
      prevErrorRef.current = error;
    }, [error]);

    // ── Imperative handle ──────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      shake: () => shakeRef.current?.shake(),
      focus: () => {
        const firstEmpty = digits.findIndex((d) => d === '');
        const idx = firstEmpty === -1 ? 0 : firstEmpty;
        inputRefs.current[idx]?.focus();
      },
      clear: () => {
        setDigits(Array.from({ length }, () => ''));
        inputRefs.current[0]?.focus();
      },
    }), [digits, length]);

    // ── Handlers ───────────────────────────────────────────────────────
    const handleChange = useCallback(
      (text: string, index: number) => {
        // Only accept a single digit
        const digit = text.replace(/[^0-9]/g, '').slice(-1);
        if (!digit) return;

        setDigits((prev) => {
          const next = [...prev];
          next[index] = digit;

          // Auto-submit when last digit entered
          if (index === length - 1 && next.every((d) => d !== '')) {
            // Defer the callback so state is settled
            setTimeout(() => onComplete?.(next.join('')), 0);
          }

          return next;
        });

        // Auto-advance focus
        if (index < length - 1) {
          inputRefs.current[index + 1]?.focus();
        }
      },
      [length, onComplete],
    );

    const handleKeyPress = useCallback(
      (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
        if (e.nativeEvent.key === 'Backspace') {
          setDigits((prev) => {
            const next = [...prev];
            if (next[index] !== '') {
              // Clear current box
              next[index] = '';
            } else if (index > 0) {
              // Move to previous box and clear it
              next[index - 1] = '';
              inputRefs.current[index - 1]?.focus();
            }
            return next;
          });
        }
      },
      [],
    );

    const handleFocus = useCallback((index: number) => {
      setFocusedIndex(index);
    }, []);

    const handleBlur = useCallback(() => {
      setFocusedIndex(-1);
    }, []);

    const handleBoxPress = useCallback((index: number) => {
      inputRefs.current[index]?.focus();
    }, []);

    // ── Render ─────────────────────────────────────────────────────────
    return (
      <ShakeAnimation ref={shakeRef}>
        <View
          style={styles.container}
          accessibilityRole="none"
          accessibilityLabel={`OTP input with ${length} digits`}
        >
          {digits.map((digit, index) => (
            <View key={index} style={styles.boxWrapper}>
              <OTPBox
                value={digit}
                focused={focusedIndex === index}
                error={error}
                disabled={disabled}
                onPress={() => handleBoxPress(index)}
              />
              {/* Hidden TextInput stacked behind the visual box */}
              <RNTextInput
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => handleFocus(index)}
                onBlur={handleBlur}
                keyboardType="number-pad"
                maxLength={1}
                editable={!disabled}
                selectTextOnFocus
                caretHidden
                style={styles.hiddenInput}
                accessibilityLabel={`Digit ${index + 1}`}
                // Disable auto-suggestions that can interfere on Android
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                textContentType="oneTimeCode"
              />
            </View>
          ))}
        </View>
      </ShakeAnimation>
    );
  },
);

OTPInput.displayName = 'OTPInput';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * Six boxes and five gaps have to survive the narrowest phone the app supports.
 * At 44 that is 6×44 + 5×8 = 304pt inside a 360dp Android screen's 312pt of
 * content width; the previous 48 came to 328 and overflowed both that and an
 * iPhone SE by a point. 44 is also exactly `MIN_TAP_SIZE`, so each box remains
 * its own legal target.
 */
const BOX_WIDTH = 44;
const BOX_HEIGHT = 52;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  boxWrapper: {
    position: 'relative',
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  },
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDisabled: {
    opacity: 0.5,
  },
  boxText: {
    textAlign: 'center',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
    textAlign: 'center',
    color: 'transparent',
  },
});

export default OTPInput;
