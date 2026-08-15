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
  withTiming,
} from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  fontFamily,
  fontSize,
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
//
// Four steps of half `duration.instant` — 240ms in total, well inside the
// 400ms ceiling, and short enough that it reads as the field flinching rather
// than as a wobble. The step is derived from the theme rather than typed in, so
// the shake retunes with everything else if the scale ever moves.
//
// Each leg goes through `timing()` so it carries `ReduceMotion.System`: with
// the setting on, every leg lands on its final value at once and the shake
// becomes the no-op it should be. The error is never *only* the shake — the
// message below the field says it in words.
// ---------------------------------------------------------------------------

const SHAKE_DISTANCE = 7;
const SHAKE_STEP = duration.instant / 2;

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
 * Three measured corrections live in here:
 *
 *  1. **The focus ring is drawn in `amberDark`, not marigold.** `#F0A03A` is
 *     2.14:1 on white — below the 3:1 a state indicator needs to be seen at
 *     all. `#9C5A10` measures 5.41:1 and still reads as marigold with the soft
 *     `amberLight` halo behind it.
 *  2. **The placeholder is `text.secondary`.** `text.tertiary` is the floor on
 *     paper (4.64:1) but only 4.22:1 on the *sunk* tone the well uses at rest,
 *     so it failed exactly where placeholders live. `#4F5468` measures 6.45:1
 *     there, and input text at 14.90:1 still reads as filled-in against it.
 *  3. **Focus and error are `withTiming`, never `withSpring`.** They drive a
 *     colour and an opacity; a spring on either clamps at 1.0 and stalls.
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
      focusAnim.value = withTiming(1, timing(duration.fast));
      onFocusProp?.(e);
    },
    [focusAnim, onFocusProp],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onBlur']>>[0]) => {
      focusAnim.value = withTiming(0, timing(duration.fast));
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
        withTiming(SHAKE_DISTANCE, timing(SHAKE_STEP)),
        withTiming(-SHAKE_DISTANCE, timing(SHAKE_STEP)),
        withTiming(SHAKE_DISTANCE * 0.6, timing(SHAKE_STEP)),
        withTiming(0, timing(SHAKE_STEP)),
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
            [colors.border.light, colors.primary.amberDark],
          ),
          colors.error.main,
        ],
      ),
    };
  });

  // The focus ring is a separate expanding halo so the field itself never
  // changes size — a border that grows from 1px to 2px shifts the text. The
  // halo is decoration; the border above is what carries the state.
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

  // The error belongs in the accessible name, not only in a red line below the
  // field: a screen-reader user tabbing back to a field has no other way to
  // learn why it was rejected. Callers may still override it through `rest`.
  const accessibleName = label
    ? hasError
      ? `${label}, error: ${error}`
      : label
    : undefined;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, wrapperAnimatedStyle, containerStyle]}>
      {label && (
        <Text
          variant="label"
          color={hasError ? colors.error.main : colors.text.secondary}
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
            placeholderTextColor={colors.text.secondary}
            // The selection tint stays marigold because ink on marigold is
            // 8.08:1 — selected text has to stay readable. Android's caret gets
            // the readable form, where a 2:1 hairline would vanish.
            selectionColor={colors.primary.amber}
            cursorColor={colors.primary.amberDark}
            onFocus={handleFocus}
            onBlur={handleBlur}
            accessibilityLabel={accessibleName}
            accessibilityHint={hint}
            style={[styles.input, inputStyle] as StyleProp<RNTextStyle>}
            {...rest}
          />

          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </Animated.View>
      </View>

      {hasError ? (
        <Text variant="caption" color={colors.error.main} style={styles.helper}>
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
