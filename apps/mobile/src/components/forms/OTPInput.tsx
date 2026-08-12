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

function OTPBox({ value, focused, error, disabled, onPress }: OTPBoxProps) {
  const focusAnim = useSharedValue(0);
  const fillAnim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    focusAnim.value = withSpring(focused ? 1 : 0, spring.snappy);
  }, [focused, focusAnim]);

  // A filled box pops once, so entering a digit is confirmed by the box and
  // not only by the caret moving on.
  useEffect(() => {
    fillAnim.value = withSpring(value ? 1 : 0, spring.bouncy);
  }, [value, fillAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const filled = fillAnim.value;

    return {
      borderColor: error
        ? colors.error.main
        : interpolateColor(
            Math.max(focusAnim.value, filled),
            [0, 1],
            [colors.border.light, colors.primary.amber],
          ),
      backgroundColor: error
        ? colors.error.background
        : interpolateColor(
            Math.max(focusAnim.value, filled),
            [0, 1],
            [colors.background.surfaceSecondary, colors.background.surface],
          ),
      transform: [{ scale: 1 + filled * 0.04 }],
    };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.box, animatedStyle, disabled && styles.boxDisabled]}
      accessibilityRole="none"
    >
      <Text
        variant="h2"
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

const BOX_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  boxWrapper: {
    position: 'relative',
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
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
