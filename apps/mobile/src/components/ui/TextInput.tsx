import React, { forwardRef, useCallback, useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing, layout, fontFamily, fontSize, lineHeight, MIN_TAP_SIZE } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  /** Label shown above the input. */
  label?: string;
  /** Error message — triggers red border + shake. */
  error?: string;
  /** Element rendered inside the input on the left (e.g. an icon). */
  leftIcon?: React.ReactNode;
  /** Element rendered inside the input on the right (e.g. a clear button). */
  rightIcon?: React.ReactNode;
  /** Override the outer wrapper style. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Override the inner text-input style. */
  inputStyle?: StyleProp<RNTextInputProps['style']>;
}

// ---------------------------------------------------------------------------
// Animation constants
// ---------------------------------------------------------------------------

const BORDER_SPRING = { damping: 20, stiffness: 200 };
const SHAKE_DISTANCE = 8;
const SHAKE_DURATION = 60;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AnimatedView = Animated.View;

/**
 * `<TextInput>` — themed text field with label, icons, focus animation and
 * error shake.
 *
 * ```tsx
 * <TextInput
 *   label="Email"
 *   placeholder="you@example.com"
 *   error={errors.email}
 *   leftIcon={<MailIcon />}
 * />
 * ```
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  {
    label,
    error,
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
  // ── Focus state ─────────────────────────────────────────────────────
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0); // 0 = blurred, 1 = focused

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onFocus']>>[0]) => {
      setFocused(true);
      focusAnim.value = withSpring(1, BORDER_SPRING);
      onFocusProp?.(e);
    },
    [focusAnim, onFocusProp],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<RNTextInputProps['onBlur']>>[0]) => {
      setFocused(false);
      focusAnim.value = withSpring(0, BORDER_SPRING);
      onBlurProp?.(e);
    },
    [focusAnim, onBlurProp],
  );

  // ── Shake animation ─────────────────────────────────────────────────
  const shakeX = useSharedValue(0);

  // Trigger shake when error transitions to truthy
  const prevErrorRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      shakeX.value = withSequence(
        withTiming(SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_DURATION }),
        withTiming(0, { duration: SHAKE_DURATION }),
      );
    }
    prevErrorRef.current = error;
  }, [error, shakeX]);

  // ── Animated styles ────────────────────────────────────────────────
  const hasError = !!error;

  const borderColor = hasError
    ? colors.error.main
    : focused
      ? colors.primary.amber
      : colors.border.default;

  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <AnimatedView style={[styles.container, wrapperAnimatedStyle, containerStyle]}>
      {/* Label */}
      {label && (
        <Text
          variant="bodySmallBold"
          color={hasError ? colors.error.main : colors.text.secondary}
          style={styles.label}
        >
          {label}
        </Text>
      )}

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderWidth: focused || hasError ? 2 : 1,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <RNTextInput
          ref={ref}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.primary.amber}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, inputStyle]}
          {...rest}
        />

        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>

      {/* Error message */}
      {hasError && (
        <Text variant="caption" color={colors.error.main} style={styles.error}>
          {error}
        </Text>
      )}
    </AnimatedView>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_SIZE,
    borderRadius: layout.inputRadius,
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.md,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    // Remove default underline on Android
    padding: 0,
    margin: 0,
  },
  error: {
    marginTop: spacing.xs,
  },
});

export default TextInput;
