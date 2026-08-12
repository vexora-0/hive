import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle as RNTextStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  spring,
  duration,
  timing,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  /** Label shown above the field. */
  label?: string;
  /** Error message — turns the field red and shakes it once. */
  error?: string;
  /** Quiet helper text below the field. Hidden while an error is showing. */
  hint?: string;
  /** Element rendered inside the field on the left. */
  leftIcon?: React.ReactNode;
  /** Element rendered inside the field on the right. */
  rightIcon?: React.ReactNode;
  /** Override the outer wrapper style. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Override the inner text-input style. */
  inputStyle?: StyleProp<RNTextInputProps['style']>;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const SHAKE_DISTANCE = 7;
const SHAKE_DURATION = 55;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<TextInput>` — a themed text field.
 *
 * The field is a recessed well rather than an outlined box: at rest it is a
 * sunk paper tone with no border, and focus raises it to white and draws the
 * marigold ring. That reads as writing *into* the page instead of filling in a
 * form, and it means an unfocused form is quiet — no grid of empty rectangles.
 *
 * ```tsx
 * <TextInput
 *   label="Email"
 *   hint="We'll send a 6-digit code."
 *   error={errors.email}
 *   keyboardType="email-address"
 * />
 * ```
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    containerStyle,
    inputStyle,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
    ...rest
  },
  ref,
) {
  const hasError = !!error;

  // ── Focus ───────────────────────────────────────────────────────────
  const focusAnim = useSharedValue(0); // 0 = at rest, 1 = focused

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onFocus']>>[0]) => {
      focusAnim.value = withSpring(1, spring.snappy);
      onFocusProp?.(e);
    },
    [focusAnim, onFocusProp],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onBlur']>>[0]) => {
      focusAnim.value = withSpring(0, spring.snappy);
      onBlurProp?.(e);
    },
    [focusAnim, onBlurProp],
  );

  // ── Error shake ─────────────────────────────────────────────────────
  const shakeX = useSharedValue(0);
  const errorAnim = useSharedValue(0);
  const prevErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      shakeX.value = withSequence(
        withTiming(SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(SHAKE_DISTANCE * 0.6, { duration: SHAKE_DURATION }),
        withTiming(0, { duration: SHAKE_DURATION }),
      );
    }
    errorAnim.value = withTiming(error ? 1 : 0, timing(duration.fast));
    prevErrorRef.current = error;
  }, [error, shakeX, errorAnim]);

  // ── Animated styles ────────────────────────────────────────────────
  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const fieldAnimatedStyle = useAnimatedStyle(() => {
    const focus = focusAnim.value;
    const err = errorAnim.value;

    return {
      backgroundColor: interpolateColor(
        Math.max(focus, err),
        [0, 1],
        [colors.background.surfaceSecondary, colors.background.surface],
      ),
      borderColor: interpolateColor(
        err,
        [0, 1],
        [
          interpolateColor(
            focus,
            [0, 1],
            [colors.border.light, colors.primary.amber],
          ),
          colors.error.main,
        ],
      ),
    };
  });

  // The focus ring is a separate expanding halo so the field itself never
  // changes size — a border that grows from 1px to 2px shifts the text.
  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(focusAnim.value, errorAnim.value) * 0.9,
    transform: [{ scale: 1 + (1 - Math.max(focusAnim.value, errorAnim.value)) * 0.02 }],
  }));

  const ringColorStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      errorAnim.value,
      [0, 1],
      [colors.primary.amberLight, colors.error.light],
    ),
  }));

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, wrapperAnimatedStyle, containerStyle]}>
      {label && (
        <Text
          variant="label"
          color={hasError ? colors.error.dark : colors.text.secondary}
          style={styles.label}
        >
          {label}
        </Text>
      )}

      <View>
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, ringAnimatedStyle, ringColorStyle]}
        />

        <Animated.View style={[styles.field, fieldAnimatedStyle]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

          <RNTextInput
            ref={ref}
            placeholderTextColor={colors.text.tertiary}
            selectionColor={colors.primary.amber}
            onFocus={handleFocus}
            onBlur={handleBlur}
            accessibilityLabel={label}
            style={[styles.input, inputStyle] as StyleProp<RNTextStyle>}
            {...rest}
          />

          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </Animated.View>
      </View>

      {hasError ? (
        <Text variant="caption" color={colors.error.dark} style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.text.tertiary} style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const RING_SPREAD = 4;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.sm,
  },
  ring: {
    position: 'absolute',
    top: -RING_SPREAD,
    left: -RING_SPREAD,
    right: -RING_SPREAD,
    bottom: -RING_SPREAD,
    borderRadius: radius.sm + RING_SPREAD,
    borderWidth: RING_SPREAD,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.ms,
  },
  iconLeft: {
    minWidth: 20,
    alignItems: 'center',
  },
  iconRight: {
    minWidth: MIN_TAP_SIZE / 2,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.body,
    color: colors.text.primary,
    paddingVertical: spacing.ms,
    // Kills the default Android underline and inner padding.
    padding: 0,
    margin: 0,
  },
  helper: {
    marginTop: spacing.sm,
  },
});

export default TextInput;
